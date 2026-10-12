#!/usr/bin/env python3
"""Converte snapshots do feed Atom de normativos do BCB para JSON."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ATOM_NAMESPACE = {"atom": "http://www.w3.org/2005/Atom"}


def clean_text(element: ET.Element | None) -> str:
    """Extrai texto do XML/HTML e normaliza espaços em branco."""
    if element is None:
        return ""
    return re.sub(r"\s+", " ", html.unescape("".join(element.itertext()))).strip()


def parse_feed(feed_file: Path) -> list[dict[str, str]]:
    """Lê um feed Atom e devolve itens no formato usado pela aplicação."""
    root = ET.parse(feed_file).getroot()
    items = []

    for entry in root.findall("atom:entry", ATOM_NAMESPACE):
        link = entry.find("atom:link[@rel='alternate']", ATOM_NAMESPACE)
        if link is None:
            link = entry.find("atom:link", ATOM_NAMESPACE)

        item = {
            "id": clean_text(entry.find("atom:id", ATOM_NAMESPACE)),
            "nome": clean_text(entry.find("atom:title", ATOM_NAMESPACE)),
            "descricao": clean_text(entry.find("atom:content", ATOM_NAMESPACE)),
            "data": clean_text(entry.find("atom:updated", ATOM_NAMESPACE)),
            "link": link.get("href", "").strip() if link is not None else "",
        }

        missing = [field for field, value in item.items() if not value]
        if missing:
            fields = ", ".join(missing)
            raise ValueError(f"{feed_file}: entrada com campos ausentes: {fields}")

        items.append(item)

    return items


def convert(input_dir: Path, output_file: Path, year: int) -> int:
    feed_files = sorted(input_dir.glob("feed-*.xml"))
    if not feed_files:
        raise FileNotFoundError(f"nenhum feed XML encontrado em {input_dir}")

    # Os snapshots podem repetir entradas. O mais recente, processado por último,
    # prevalece caso o BCB atualize uma normativa já publicada.
    items_by_id: dict[str, dict[str, str]] = {}
    for feed_file in feed_files:
        for item in parse_feed(feed_file):
            if not item["data"].startswith(f"{year}-"):
                continue
            items_by_id[item["id"]] = item

    items = sorted(
        items_by_id.values(),
        key=lambda item: (item["data"], item["id"]),
        reverse=True,
    )

    output_file.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = output_file.with_suffix(f"{output_file.suffix}.tmp")
    temporary_file.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_file.replace(output_file)
    return len(items)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Converte feeds Atom do BCB para o JSON do BACEN Navigator."
    )
    parser.add_argument("--year", type=int, required=True, help="ano das normativas")
    parser.add_argument(
        "--input-dir", type=Path, required=True, help="pasta com os arquivos feed-*.xml"
    )
    parser.add_argument("--output", type=Path, required=True, help="arquivo JSON de saída")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        count = convert(args.input_dir, args.output, args.year)
    except (ET.ParseError, OSError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 1

    print(f"{count} normativas gravadas em {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
