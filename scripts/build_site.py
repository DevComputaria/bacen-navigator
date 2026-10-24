#!/usr/bin/env python3
"""Monta o artefato estático com a aplicação e os JSONs detalhados."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def build(src_dir: Path, docs_dir: Path, output_dir: Path) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir)
    shutil.copytree(src_dir, output_dir)

    index = json.loads((docs_dir / "index.json").read_text(encoding="utf-8"))
    published = 0
    for entry in index["items"].values():
        source = docs_dir / entry["json_path"]
        target = output_dir / "normativas" / entry["json_path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        published += 1

    status = {
        "updated_at": index.get("updated_at"),
        "total": published,
    }
    (output_dir / "data-status.json").write_text(
        json.dumps(status, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src-dir", default=Path("src"), type=Path)
    parser.add_argument("--docs-dir", default=Path("docs"), type=Path)
    parser.add_argument("--output-dir", default=Path("dist"), type=Path)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    build(args.src_dir, args.docs_dir, args.output_dir)
