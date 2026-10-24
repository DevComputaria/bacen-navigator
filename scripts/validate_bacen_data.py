#!/usr/bin/env python3
"""Valida a consistência entre feed, índices resumidos e documentos completos."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from convert_bacen_feed import REQUIRED_FIELDS, parse_feed


def validate(sources: list[Path], feed_dir: Path, docs_dir: Path) -> list[str]:
    errors: list[str] = []
    index_path = docs_dir / "index.json"
    if not index_path.is_file():
        return [f"índice ausente: {index_path}"]

    index = json.loads(index_path.read_text(encoding="utf-8"))
    index_items = index.get("items", {}) if isinstance(index, dict) else {}
    if not isinstance(index_items, dict):
        return [f"campo items inválido em {index_path}"]

    source_by_id: dict[str, dict[str, object]] = {}
    source_keys: set[str] = set()
    source_years = {source.stem.rsplit("_", 1)[-1] for source in sources}
    latest_year = max(source_years)
    for source in sources:
        year = source.stem.rsplit("_", 1)[-1]
        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            errors.append(f"{source}: raiz deve ser uma lista")
            continue
        for position, item in enumerate(data):
            if not isinstance(item, dict):
                errors.append(f"{source}: item {position} não é um objeto")
                continue
            missing = [field for field in REQUIRED_FIELDS if not item.get(field)]
            if missing:
                errors.append(f"{source}: item {position} sem {', '.join(missing)}")
                continue
            item_id = str(item["id"])
            key = f"{year}/{item_id}"
            if key in source_keys:
                errors.append(f"ID duplicado: {key}")
            source_keys.add(key)
            source_by_id[item_id] = item
            if not str(item["data"]).startswith(f"{year}-"):
                errors.append(f"{key}: data fora do ano {year}")

    feed_files = sorted(feed_dir.glob("feed-*.xml"))
    if not feed_files:
        errors.append(f"nenhum feed encontrado em {feed_dir}")
    else:
        for item in parse_feed(feed_files[-1]):
            if item["id"] not in source_by_id:
                errors.append(f"item do feed mais recente ausente dos JSONs: {item['id']}")

    for key in sorted(source_keys):
        entry = index_items.get(key)
        if not isinstance(entry, dict):
            errors.append(f"documento ausente no índice: {key}")
            continue
        required_index_fields = ["json_path", "markdown_path"]
        if key.startswith(f"{latest_year}/"):
            required_index_fields.extend(
                ["content_hash", "verificado_em", "status", "schema_version"]
            )
        for field in required_index_fields:
            if not entry.get(field):
                errors.append(f"{key}: índice sem {field}")
        json_path = docs_dir / str(entry.get("json_path", ""))
        markdown_path = docs_dir / str(entry.get("markdown_path", ""))
        if not json_path.is_file():
            errors.append(f"{key}: JSON detalhado ausente")
            continue
        if not markdown_path.is_file():
            errors.append(f"{key}: Markdown detalhado ausente")
        document = json.loads(json_path.read_text(encoding="utf-8"))
        content = document.get("conteudo", {}) if isinstance(document, dict) else {}
        required_content_fields = ["texto"]
        if key.startswith(f"{latest_year}/"):
            required_content_fields.extend(["texto_html", "links", "imagens"])
        for field in required_content_fields:
            if field not in content:
                errors.append(f"{key}: conteúdo sem {field}")
        if not str(content.get("texto", "")).strip():
            errors.append(f"{key}: texto vazio")

    extra = sorted(set(index_items) - source_keys)
    if extra:
        errors.append(f"índice contém {len(extra)} itens que não estão nas fontes")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument("--feed-dir", required=True, type=Path)
    parser.add_argument("--docs-dir", default=Path("docs"), type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        errors = validate(args.sources, args.feed_dir, args.docs_dir)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Erro de validação: {error}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f"Erro: {error}", file=sys.stderr)
        return 1
    print("Validação concluída sem erros")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
