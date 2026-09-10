"""The day measures, on fields whose answer can be counted by hand.

A field is (days, cells), as it comes from the daily grid.
"""

from __future__ import annotations

import numpy as np
import pytest
from tagesmasse import schwellentage, tage_seit


def test_frosttage_zaehlt_die_tage_unter_null():
    frost = schwellentage(0.0, ueber=False)
    tage = np.array([[-3.0], [0.0], [1.5], [-0.1], [8.0], [-9.0], [2.0]])
    assert frost(tage).ravel().tolist() == [1, 0, 0, 1, 0, 1, 0]
    # Die Woche summiert das Tagesmass, hier also drei Frosttage.
    assert frost(tage).sum() == pytest.approx(3.0)


def test_hitzetage_zaehlt_die_tage_ueber_der_schwelle():
    hitze = schwellentage(25.0, ueber=True)
    tage = np.array([[25.0], [25.1], [30.0], [24.9]])
    assert hitze(tage).ravel().tolist() == [0, 1, 1, 0]


def test_schwellentage_laesst_einen_tag_ohne_wert_leer():
    frost = schwellentage(0.0, ueber=False)
    massgabe = frost(np.array([[-1.0, np.nan], [5.0, np.nan]]))
    assert massgabe[0, 0] == 1.0
    assert np.isnan(massgabe[:, 1]).all()
    # Die Wochensumme ueberspringt NaN, eine Zelle ohne Wert bleibt also leer.
    assert np.nansum(massgabe[:, 1]) == 0.0


def test_tage_seit_faengt_bei_der_kappung_an():
    # Vor dem ersten Tag der Aufzeichnung weiss niemand, wann es zuletzt
    # geregnet hat.
    seit = tage_seit(5.0, 60)
    assert seit(np.array([[0.0]])).ravel().tolist() == [60.0]


def test_tage_seit_setzt_am_regentag_zurueck_und_zaehlt_dann_hoch():
    seit = tage_seit(5.0, 60)
    tage = np.array([[9.0], [0.0], [1.0], [4.9], [5.1], [0.0]])
    assert seit(tage).ravel().tolist() == [0.0, 1.0, 2.0, 3.0, 0.0, 1.0]


def test_tage_seit_kappt_die_lange_trockenheit():
    seit = tage_seit(5.0, 10)
    trocken = np.zeros((30, 1))
    verlauf = seit(trocken).ravel()
    assert verlauf[9] == 10.0
    assert verlauf[-1] == 10.0


def test_tage_seit_traegt_den_zaehler_ueber_die_jahresdateien():
    # Die Kette ruft das Mass je Jahresdatei einmal auf.
    seit = tage_seit(5.0, 60)
    seit(np.array([[9.0]]))
    assert seit(np.array([[0.0], [0.0]])).ravel().tolist() == [1.0, 2.0]


def test_tage_seit_haelt_den_zaehler_ueber_einen_tag_ohne_wert():
    seit = tage_seit(5.0, 60)
    verlauf = seit(np.array([[9.0], [np.nan], [0.0]])).ravel()
    assert verlauf[0] == 0.0
    assert np.isnan(verlauf[1])
    # Der Tag ohne Wert zaehlt als trockener Tag, also steht danach die 2.
    assert verlauf[2] == 2.0


def test_tage_seit_rechnet_jede_zelle_fuer_sich():
    seit = tage_seit(5.0, 60)
    verlauf = seit(np.array([[9.0, 0.0], [0.0, 9.0]]))
    assert verlauf[1].tolist() == [1.0, 0.0]
