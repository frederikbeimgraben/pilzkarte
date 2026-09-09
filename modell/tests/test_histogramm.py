"""The histogram function, against fields whose answer is known by hand."""

from __future__ import annotations

import numpy as np
import pytest
from manifest import KLASSEN, histogramm, werte_aus_kacheln
from PIL import Image


def test_klassen_decken_die_skala():
    h = histogramm(np.linspace(0.0, 10.0, 1000), 0.0, 10.0)
    assert len(h["klassen"]) == KLASSEN + 1
    assert len(h["anteile"]) == KLASSEN
    assert h["klassen"][0] == 0.0
    assert h["klassen"][-1] == 10.0
    schritte = np.diff(h["klassen"])
    assert np.allclose(schritte, schritte[0])


def test_anteile_summieren_zu_eins():
    rng = np.random.default_rng(7)
    h = histogramm(rng.normal(5.0, 2.0, 50_000), 0.0, 10.0)
    assert sum(h["anteile"]) == pytest.approx(1.0, abs=1e-4)


def test_gleichverteilung_fuellt_jede_klasse_gleich():
    # Ein Wert in der Mitte jeder Klasse, jede Klasse also gleich schwer.
    mitten = np.linspace(0.0, 8.0, KLASSEN, endpoint=False) + 0.1
    h = histogramm(mitten, 0.0, 8.0)
    assert h["anteile"] == [pytest.approx(1 / KLASSEN)] * KLASSEN


def test_punkte_ohne_daten_zaehlen_nicht():
    feld = np.array([[np.nan, 0.5], [np.inf, 0.5]])
    h = histogramm(feld, 0.0, 1.0)
    # Beide gueltigen Punkte liegen in derselben Klasse, also 1.0 dort.
    assert sum(h["anteile"]) == pytest.approx(1.0)
    assert max(h["anteile"]) == pytest.approx(1.0)


def test_feld_ohne_gueltigen_punkt_gibt_nichts():
    assert histogramm(np.full((4, 4), np.nan), 0.0, 1.0) is None


def test_werte_ausserhalb_der_skala_fallen_in_die_raender():
    h = histogramm(np.array([-100.0, 100.0]), 0.0, 1.0)
    assert h["anteile"][0] == pytest.approx(0.5)
    assert h["anteile"][-1] == pytest.approx(0.5)


def test_null_ist_ein_wert_und_kein_fehlender_punkt():
    h = histogramm(np.array([0.0, 0.0, 1.0]), 0.0, 1.0)
    assert h["anteile"][0] == pytest.approx(2 / 3)
    assert h["anteile"][-1] == pytest.approx(1 / 3)


def test_skala_ohne_breite_ist_ein_fehler():
    with pytest.raises(ValueError):
        histogramm(np.array([1.0]), 5.0, 5.0)


def test_kacheln_lesen_das_byte_null_als_keine_daten(tmp_path):
    # Ein Byte je Punkt: 0 keine Daten, 1 bis 255 linear ueber die Skala.
    bild = np.array([[0, 1, 255, 0]], dtype="uint8")
    ordner = tmp_path / "5" / "16"
    ordner.mkdir(parents=True)
    Image.fromarray(bild, mode="L").save(ordner / "10.png")

    werte = werte_aus_kacheln(tmp_path, ["16/10"], "5", 10.0, 20.0)
    assert werte.tolist() == [10.0, 20.0]
    assert werte_aus_kacheln(tmp_path, ["99/99"], "5", 10.0, 20.0) is None
