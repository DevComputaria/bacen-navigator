from __future__ import annotations

import argparse
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import extract_bacen_texts as extractor
import convert_bacen_feed as converter


def api_payload(version: float, text: str) -> dict[str, object]:
    return {
        "conteudo": [
            {
                "Titulo": "Norma de teste",
                "Tipo": "Resolução BCB",
                "Numero": "1",
                "Data": "2026-10-01T00:00:00Z",
                "DataTexto": "1º de outubro de 2026",
                "Assunto": "<p>Teste</p>",
                "DOU": "",
                "Referencias": None,
                "NormasVinculadas": None,
                "Atualizacoes": None,
                "Revogado": False,
                "Cancelado": False,
                "VersaoNormativo": version,
                "Id": 1,
                "Texto": text,
            }
        ]
    }


class PipelineTests(unittest.TestCase):
    def test_escapes_legal_dashes_in_markdown_body(self) -> None:
        value = "VIII\n- componente responsável: exemplo\ntexto"
        self.assertEqual(
            extractor.markdown_body_text(value),
            "VIII\n\\- componente responsável: exemplo\ntexto",
        )

    def test_preserves_html_links_and_images(self) -> None:
        content = extractor.normalize_content(
            api_payload(
                1.0,
                '<p>Corpo <a href="https://www.bcb.gov.br/a">fonte</a>'
                '<img src="https&#58;//www.bcb.gov.br/i.gif" alt="fórmula"></p>',
            )["conteudo"][0]
        )
        self.assertIn("<img", content["texto_html"])
        self.assertEqual(content["links"], ["https://www.bcb.gov.br/a"])
        self.assertEqual(
            content["imagens"],
            [{"src": "https://www.bcb.gov.br/i.gif", "alt": "fórmula"}],
        )

    def test_replaces_preliminary_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "normativas_2026.json"
            output = root / "docs"
            source.write_text(
                json.dumps(
                    [
                        {
                            "id": "normativos_1",
                            "nome": "BC - Resolução BCB N° 1 de 01/10/2026",
                            "descricao": "Teste",
                            "data": "2026-10-01T00:00:00-03:00",
                            "link": "https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=1",
                        }
                    ]
                ),
                encoding="utf-8",
            )
            args = argparse.Namespace(
                sources=[source], output_dir=output, timeout=1, retries=1,
                delay=0, max_items=None, refresh_days=10000, force=False,
            )
            with patch.object(extractor, "fetch_json", return_value=api_payload(0.0, "<p>Preliminar</p>")):
                updated, _, failed = extractor.run(args)
            self.assertEqual((updated, failed), (1, 0))

            with patch.object(extractor, "fetch_json", return_value=api_payload(1.0, "<p>Definitivo e completo</p>")):
                updated, _, failed = extractor.run(args)
            self.assertEqual((updated, failed), (1, 0))
            document = json.loads((output / "2026/normativos_1/normativa.json").read_text())
            self.assertEqual(document["conteudo"]["versao"], 1.0)
            self.assertEqual(document["conteudo"]["texto"], "Definitivo e completo")
            index = json.loads((output / "index.json").read_text())
            self.assertEqual(index["version"], 2)
            self.assertTrue(index["items"]["2026/normativos_1"]["content_hash"])

            with patch.object(extractor, "fetch_json", return_value=api_payload(1.0, "<p>Definitivo e completo</p>")):
                updated, checked, failed = extractor.run(args)
            self.assertEqual((updated, checked, failed), (0, 1, 0))

    def test_does_not_write_partial_results_on_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "normativas_2026.json"
            output = root / "docs"
            items = []
            for number in (1, 2):
                items.append(
                    {
                        "id": f"normativos_{number}",
                        "nome": f"BC - Resolução BCB N° {number}",
                        "descricao": "Teste",
                        "data": "2026-10-01T00:00:00-03:00",
                        "link": "https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo"
                        f"?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero={number}",
                    }
                )
            source.write_text(json.dumps(items), encoding="utf-8")
            args = argparse.Namespace(
                sources=[source], output_dir=output, timeout=1, retries=1,
                delay=0, max_items=None, refresh_days=45, force=False,
            )
            with patch.object(
                extractor,
                "fetch_json",
                side_effect=[api_payload(1.0, "<p>Válido</p>"), RuntimeError("API fora")],
            ):
                updated, _, failed = extractor.run(args)
            self.assertEqual((updated, failed), (1, 1))
            self.assertFalse((output / "index.json").exists())
            self.assertFalse((output / "2026/normativos_1/normativa.json").exists())

    def test_feed_window_does_not_remove_history(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            feeds = root / "feeds"
            feeds.mkdir()
            output = root / "normativas_2026.json"
            historical = {
                "id": "normativos_old",
                "nome": "Norma histórica",
                "descricao": "Preservada",
                "data": "2026-01-01T00:00:00-03:00",
                "link": "https://www.bcb.gov.br/historica",
            }
            output.write_text(json.dumps([historical]), encoding="utf-8")
            (feeds / "feed-20261024-000000.xml").write_text(
                """<?xml version="1.0" encoding="utf-8"?>
                <feed xmlns="http://www.w3.org/2005/Atom">
                  <entry><id>normativos_new</id><title>Norma nova</title>
                  <content>Nova</content><updated>2026-10-24T00:00:00-03:00</updated>
                  <link rel="alternate" href="https://www.bcb.gov.br/nova" /></entry>
                </feed>""",
                encoding="utf-8",
            )
            count = converter.convert(feeds, output, 2026)
            ids = {item["id"] for item in json.loads(output.read_text())}
            self.assertEqual(count, 2)
            self.assertEqual(ids, {"normativos_old", "normativos_new"})


if __name__ == "__main__":
    unittest.main()
