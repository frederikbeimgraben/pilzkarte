"""The manifest: the shape of a histogram entry, and the file the chain writes."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from manifest import KLASSEN, histogramm, schreibe

KARTEN = Path(__file__).resolve().parents[1] / "reports" / "maps"


def pruefe(h: dict, low: float, high: float) -> None:
    """A histogram entry as the app may rely on it."""
    assert set(h) == {"klassen", "anteile"}
    assert len(h["klassen"]) == KLASSEN + 1
    assert len(h["anteile"]) == KLASSEN
    # Die Kanten stehen auf sechs Nachkommastellen gerundet im Manifest.
    assert h["klassen"][0] == pytest.approx(low, abs=1e-6)
    assert h["klassen"][-1] == pytest.approx(high, abs=1e-6)
    assert h["klassen"] == sorted(h["klassen"])
    assert min(h["anteile"]) >= 0.0
    assert sum(h["anteile"]) == pytest.approx(1.0, abs=1e-4)


def test_art_traegt_das_histogramm_an_der_woche(tmp_path):
    top = 0.5043
    meta = {"name": "boletus_edulis", "top": top,
            "weeks": [{"year": 2026, "week": 36, "forecast": False,
                       "histogramm": histogramm(np.linspace(0, top, 500), 0.0, top)}]}
    pfad = tmp_path / "boletus_edulis.json"
    schreibe(pfad, meta)
    gelesen = json.loads(pfad.read_text())
    pruefe(gelesen["weeks"][0]["histogramm"], 0.0, top)


def test_wochenebene_traegt_die_histogramme_neben_weeks(tmp_path):
    low, high = -3.6, 24.7
    meta = {"layers": {"temperatur": {
        "label": "Mitteltemperatur der Woche", "unit": "Grad", "static": False,
        "low": low, "high": high, "weeks": ["2026W35", "2026W36"],
        "histogramme": {k: histogramm(np.linspace(low, high, 500), low, high)
                        for k in ("2026W35", "2026W36")}}}}
    pfad = tmp_path / "layers.json"
    schreibe(pfad, meta)
    ebene = json.loads(pfad.read_text())["layers"]["temperatur"]
    # `weeks` bleibt eine Liste von Wochenschluesseln. update.sh raeumt die
    # Kachelordner nach ihr auf.
    assert ebene["weeks"] == ["2026W35", "2026W36"]
    for schluessel in ebene["weeks"]:
        pruefe(ebene["histogramme"][schluessel], low, high)


def test_schreibe_haelt_zahlenlisten_auf_einer_zeile(tmp_path):
    pfad = tmp_path / "m.json"
    meta = {"bounds": [[47.1, 4.9], [55.2, 15.1]], "zooms": [5, 8],
            "have": {"5": ["16/10", "16/11"]},
            "histogramm": histogramm(np.linspace(0, 1, 100), 0.0, 1.0)}
    schreibe(pfad, meta)
    text = pfad.read_text()
    assert json.loads(text) == meta
    assert '"anteile": [' in text
    assert text.count("\n") < 20
    # Zeichenketten bleiben, wie json sie setzt.
    assert '"16/10",' in text


@pytest.mark.skipif(not KARTEN.is_dir(),
                    reason="reports/maps liegt nicht im Repo, nur auf der Maschine der Kette")
def test_gerenderte_manifeste_halten_das_schema():
    for pfad in sorted(KARTEN.glob("*.json")):
        meta = json.loads(pfad.read_text())
        if pfad.name == "layers.json":
            for ebene in meta["layers"].values():
                if ebene.get("static"):
                    pruefe(ebene["histogramm"], ebene["low"], ebene["high"])
                    continue
                for schluessel in ebene["weeks"]:
                    pruefe(ebene["histogramme"][schluessel], ebene["low"], ebene["high"])
        elif "weeks" in meta:
            for woche in meta["weeks"]:
                pruefe(woche["histogramm"], 0.0, meta["top"])
