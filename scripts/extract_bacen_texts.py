#!/usr/bin/env python3
"""Extrai textos de normativas pela API oficial do Banco Central do Brasil."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


API_URL = "https://www.bcb.gov.br/api/conteudo/app/normativos/exibenormativo"
BCB_HOSTS = {"bcb.gov.br", "www.bcb.gov.br"}
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")
BLOCK_TAGS = {
    "address", "article", "blockquote", "br", "div", "footer", "h1", "h2",
    "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "ol", "p",
    "section", "table", "td", "th", "tr", "ul",
}


class TextExtractor(HTMLParser):
    """Converte o HTML legado retornado pela API em texto legível."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.ignored_depth += 1
        elif not self.ignored_depth and tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.ignored_depth:
            self.ignored_depth -= 1
        elif not self.ignored_depth and tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.ignored_depth:
            self.parts.append(data)

    def text(self) -> str:
        value = html.unescape("".join(self.parts)).replace("\u200b", "")
        lines = [re.sub(r"[ \t\f\v]+", " ", line).strip() for line in value.splitlines()]
        result: list[str] = []
        for line in lines:
            if line:
                result.append(line)
            elif result and result[-1] != "":
                result.append("")
        return "\n".join(result).strip()


class AssetExtractor(HTMLParser):
    """Coleta destinos de links e imagens sem tentar renderizar o HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.images: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): html.unescape(value or "") for key, value in attrs}
        if tag.lower() == "a" and attributes.get("href"):
            self.links.append(attributes["href"].strip())
        elif tag.lower() == "img" and attributes.get("src"):
            self.images.append(
                {
                    "src": attributes["src"].strip(),
                    "alt": attributes.get("alt", "").strip(),
                }
            )


def html_to_text(value: Any) -> str:
    parser = TextExtractor()
    parser.feed(str(value) if value is not None else "")
    parser.close()
    return parser.text()


def extract_assets(value: Any) -> tuple[list[str], list[dict[str, str]]]:
    parser = AssetExtractor()
    parser.feed(str(value) if value is not None else "")
    parser.close()
    return list(dict.fromkeys(parser.links)), list(
        {json.dumps(image, sort_keys=True): image for image in parser.images}.values()
    )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    write_text(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(value, encoding="utf-8")
    temporary.replace(path)


def load_sources(paths: list[Path]) -> list[tuple[int, dict[str, Any]]]:
    records: list[tuple[int, dict[str, Any]]] = []
    seen: set[str] = set()

    for path in paths:
        match = re.search(r"(20\d{2})", path.stem)
        if not match:
            raise ValueError(f"não foi possível identificar o ano em {path}")
        year = int(match.group(1))
        data = read_json(path)
        if not isinstance(data, list):
            raise ValueError(f"{path} deve conter uma lista JSON")

        for item in data:
            if not isinstance(item, dict):
                raise ValueError(f"{path} contém um item que não é objeto")
            item_id = str(item.get("id", ""))
            key = f"{year}/{item_id}"
            if key not in seen:
                records.append((year, item))
                seen.add(key)

    return records


def load_index(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 2, "updated_at": None, "items": {}}
    index = read_json(path)
    if not isinstance(index, dict) or index.get("version") not in {1, 2}:
        raise ValueError(f"formato de índice inválido em {path}")
    if not isinstance(index.get("items"), dict):
        raise ValueError(f"campo items inválido em {path}")
    index["version"] = 2
    return index


def api_parameters(item: dict[str, Any]) -> tuple[str, str]:
    source_url = str(item.get("link", ""))
    parsed = urlparse(source_url)
    if parsed.scheme != "https" or parsed.hostname not in BCB_HOSTS:
        raise ValueError("link não pertence ao domínio HTTPS do Banco Central")

    query = parse_qs(parsed.query)
    norm_type = query.get("tipo", [""])[0].strip()
    number = query.get("numero", [""])[0].strip()
    if not norm_type or not number:
        raise ValueError("link sem os parâmetros tipo e numero")
    return norm_type, number


def fetch_json(url: str, timeout: float, retries: int) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "bacen-navigator/1.0 (+https://github.com/DevComputaria/bacen-navigator)",
        },
    )

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urlopen(request, timeout=timeout) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                payload = json.loads(response.read().decode(charset))
                if not isinstance(payload, dict):
                    raise ValueError("resposta da API não é um objeto JSON")
                return payload
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
            last_error = error
            if attempt < retries:
                time.sleep(min(2 ** (attempt - 1), 8))

    raise RuntimeError(f"falha após {retries} tentativas: {last_error}")


def normalize_content(raw: dict[str, Any]) -> dict[str, Any]:
    source_html = str(raw.get("Texto") or "")
    text = html_to_text(source_html)
    if not text:
        raise ValueError("a API retornou uma normativa sem texto")
    links, images = extract_assets(source_html)

    return {
        "titulo": raw.get("Titulo"),
        "tipo": raw.get("Tipo"),
        "numero": raw.get("Numero"),
        "data": raw.get("Data"),
        "data_texto": raw.get("DataTexto"),
        "assunto": html_to_text(raw.get("Assunto")),
        "dou": html_to_text(raw.get("DOU")),
        "referencias": raw.get("Referencias"),
        "normas_vinculadas": raw.get("NormasVinculadas"),
        "atualizacoes": raw.get("Atualizacoes"),
        "revogado": bool(raw.get("Revogado")),
        "cancelado": bool(raw.get("Cancelado")),
        "versao": raw.get("VersaoNormativo"),
        "id_bcb": raw.get("Id"),
        "texto_html": source_html,
        "texto": text,
        "links": links,
        "imagens": images,
    }


def content_hash(document: dict[str, Any]) -> str:
    """Identifica mudanças relevantes sem incluir timestamps da extração."""
    relevant = {
        "nome": document.get("nome"),
        "descricao": document.get("descricao"),
        "data_feed": document.get("data_feed"),
        "link": document.get("link"),
        "conteudo": document.get("conteudo"),
    }
    serialized = json.dumps(relevant, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def extract_item(item: dict[str, Any], year: int, checked_at: str, timeout: float, retries: int) -> dict[str, Any]:
    item_id = str(item.get("id", "")).strip()
    if not SAFE_ID.fullmatch(item_id):
        raise ValueError(f"id inválido: {item_id!r}")

    norm_type, number = api_parameters(item)
    api_url = f"{API_URL}?{urlencode({'p1': norm_type, 'p2': number})}"
    payload = fetch_json(api_url, timeout, retries)
    contents = payload.get("conteudo")
    if not isinstance(contents, list) or not contents:
        raise ValueError("a API não retornou conteúdo para a normativa")

    versions = [entry for entry in contents if isinstance(entry, dict)]
    if not versions:
        raise ValueError("conteúdo da API em formato inválido")
    raw = max(versions, key=lambda entry: float(entry.get("VersaoNormativo") or 0))

    return {
        "id": item_id,
        "ano": year,
        "nome": item.get("nome"),
        "descricao": item.get("descricao"),
        "data_feed": item.get("data"),
        "link": item.get("link"),
        "api_url": api_url,
        "extraido_em": checked_at,
        "verificado_em": checked_at,
        "conteudo": normalize_content(raw),
    }


def markdown_escape(value: Any) -> str:
    return str(value or "").replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")


def markdown_document(document: dict[str, Any]) -> str:
    content = document["conteudo"]
    references = [part.strip() for part in str(content.get("referencias") or "").split(";#") if part.strip()]
    lines = [
        f"# {content.get('titulo') or document.get('nome')}",
        "",
        f"- **ID:** `{document['id']}`",
        f"- **Ano:** {document['ano']}",
        f"- **Data:** {content.get('data_texto') or document.get('data_feed') or ''}",
        f"- **Tipo:** {content.get('tipo') or ''}",
        f"- **Número:** {content.get('numero') or ''}",
        f"- **Revogado:** {'Sim' if content.get('revogado') else 'Não'}",
        f"- **Cancelado:** {'Sim' if content.get('cancelado') else 'Não'}",
        f"- **Fonte:** [{markdown_escape(document['link'])}]({document['link']})",
        "",
        "## Assunto",
        "",
        content.get("assunto") or document.get("descricao") or "Não informado.",
    ]

    if content.get("dou"):
        lines.extend(["", "## Diário Oficial da União", "", content["dou"]])
    if references:
        lines.extend(["", "## Referências", ""])
        lines.extend(f"- {reference}" for reference in references)

    lines.extend(["", "## Texto", "", content["texto"], ""])
    return "\n".join(lines)


def index_markdown(index: dict[str, Any]) -> str:
    items = sorted(
        index["items"].values(),
        key=lambda item: (int(item["ano"]), str(item.get("data_feed") or ""), item["id"]),
        reverse=True,
    )
    lines = [
        "# Índice de textos das normativas",
        "",
        f"**Total extraído:** {len(items)}",
        "",
        f"**Última atualização:** {index.get('updated_at') or 'Ainda não executado'}",
        "",
        "Este arquivo é gerado automaticamente por `scripts/extract_bacen_texts.py`.",
    ]

    current_year = None
    for item in items:
        if item["ano"] != current_year:
            current_year = item["ano"]
            lines.extend(["", f"## {current_year}", ""])
        lines.append(
            f"- [{markdown_escape(item['nome'])}]({item['markdown_path']}) "
            f"— `{item['id']}`"
        )

    lines.append("")
    return "\n".join(lines)


def output_files_exist(output_dir: Path, entry: dict[str, Any]) -> bool:
    return all(
        (output_dir / entry[field]).is_file()
        for field in ("json_path", "markdown_path")
    )


def parse_feed_date(value: Any) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def source_changed(previous: dict[str, Any], item: dict[str, Any]) -> bool:
    return any(
        previous.get(index_field) != item.get(source_field)
        for index_field, source_field in (
            ("nome", "nome"),
            ("data_feed", "data"),
            ("link", "link"),
        )
    )


def should_refresh(
    item: dict[str, Any],
    previous: dict[str, Any] | None,
    output_dir: Path,
    refresh_since: datetime,
    force: bool,
) -> bool:
    if force or not previous or not output_files_exist(output_dir, previous):
        return True
    feed_date = parse_feed_date(item.get("data"))
    return source_changed(previous, item) or bool(feed_date and feed_date >= refresh_since)


def run(args: argparse.Namespace) -> tuple[int, int, int]:
    index_path = args.output_dir / "index.json"
    markdown_index_path = args.output_dir / "index.md"
    index = load_index(index_path)
    records = load_sources(args.sources)
    updated = 0
    verified = 0
    skipped = 0
    failed = 0
    checked_at = datetime.now(timezone.utc)
    refresh_since = checked_at - timedelta(days=args.refresh_days)
    pending_writes: list[tuple[Path, dict[str, Any], Path, str]] = []

    for year, item in records:
        if args.max_items is not None and updated + verified + failed >= args.max_items:
            break

        item_id = str(item.get("id", "")).strip()
        key = f"{year}/{item_id}"
        previous = index["items"].get(key)
        if not should_refresh(item, previous, args.output_dir, refresh_since, args.force):
            skipped += 1
            continue

        try:
            timestamp = checked_at.isoformat()
            document = extract_item(item, year, timestamp, args.timeout, args.retries)
            digest = content_hash(document)
            relative_dir = Path(str(year)) / item_id
            json_path = relative_dir / "normativa.json"
            markdown_path = relative_dir / "normativa.md"
            previous_hash = previous.get("content_hash") if previous else None
            changed = args.force or not previous or digest != previous_hash
            extracted_at = timestamp
            if previous and not changed:
                extracted_at = previous.get("extraido_em") or timestamp
                document["extraido_em"] = extracted_at
                verified += 1
                print(f"Verificado sem alteração: {key}")
            else:
                pending_writes.append(
                    (
                        args.output_dir / json_path,
                        document,
                        args.output_dir / markdown_path,
                        markdown_document(document),
                    )
                )
                updated += 1
                print(f"Atualizado: {key}")
            index["items"][key] = {
                "id": item_id,
                "ano": year,
                "nome": item.get("nome"),
                "data_feed": item.get("data"),
                "link": item.get("link"),
                "json_path": json_path.as_posix(),
                "markdown_path": markdown_path.as_posix(),
                "extraido_em": extracted_at,
                "verificado_em": timestamp,
                "versao": document["conteudo"].get("versao"),
                "content_hash": digest,
                "status": "ok",
                "schema_version": 2,
                "id_bcb": document["conteudo"].get("id_bcb"),
            }
        except (OSError, RuntimeError, ValueError) as error:
            failed += 1
            print(f"Falha: {key}: {error}", file=sys.stderr)

        if args.delay:
            time.sleep(args.delay)

    if not failed:
        for json_path, document, markdown_path, markdown in pending_writes:
            write_json(json_path, document)
            write_text(markdown_path, markdown)
        index["updated_at"] = checked_at.isoformat()
        write_json(index_path, index)
        write_text(markdown_index_path, index_markdown(index))

    print(
        f"Resumo: {updated} atualizados, {verified} verificados, "
        f"{skipped} ignorados, {failed} falhas"
    )
    return updated, verified + skipped, failed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extrai textos de normativas pela API do BCB.")
    parser.add_argument("sources", nargs="+", type=Path, help="arquivos normativas_ANO.json")
    parser.add_argument("--output-dir", type=Path, default=Path("docs"))
    parser.add_argument("--timeout", type=float, default=30)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument("--max-items", type=int, help="limita itens processados (útil em testes)")
    parser.add_argument(
        "--refresh-days",
        type=int,
        default=45,
        help="revalida normativas publicadas nos últimos N dias (padrão: 45)",
    )
    parser.add_argument("--force", action="store_true", help="reextrai itens já presentes no índice")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.retries < 1 or args.delay < 0 or args.timeout <= 0 or args.refresh_days < 0:
        print("Erro: parâmetros numéricos inválidos", file=sys.stderr)
        return 2

    try:
        updated, skipped, failed = run(args)
    except (json.JSONDecodeError, OSError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 1

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
