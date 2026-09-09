"""Tests of the species count and the season table.

The frame is small enough to check by hand: two observers, four days, three
species. Run them from `modell/` with `nix develop --command pytest tests`.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "pilze"))

from arten_zaehlen import (  # noqa: E402
    arten_namen,
    begehungen_bilden,
    bericht,
    letzte_volle_woche,
    main,
    saisontabelle,
    stufe,
    wochenreihe,
)

STAND = (2026, 34)


def _occ() -> pd.DataFrame:
    """Six records in four visits, two of them too coarse or too lonely."""
    zeilen = [
        # Zwei Arten am selben Tag im selben Kilometer: eine gueltige Begehung.
        ("Boletus edulis", "anna", "2024-10-01", 40, 2024, 40, None),
        ("Imleria badia", "anna", "2024-10-01", 40, 2024, 40, None),
        # Derselbe Beobachter, andere Woche, wieder zwei Arten.
        ("Imleria badia", "anna", "2024-10-08", 41, 2024, 41, 100),
        ("Cantharellus cibarius", "anna", "2024-10-08", 41, 2024, 41, 100),
        # Nur eine Art: keine Begehung.
        ("Boletus edulis", "bert", "2024-10-01", 40, 2024, 40, None),
        # Zu ungenau verortet, darum verworfen.
        ("Boletus edulis", "cara", "2025-10-01", 40, 2025, 40, 5000),
        ("Imleria badia", "cara", "2025-10-01", 40, 2025, 40, 5000),
        # Im laufenden Jahr, eine gueltige Begehung.
        ("Boletus edulis", "dora", "2026-06-01", 23, 2026, 23, None),
        ("Imleria badia", "dora", "2026-06-01", 23, 2026, 23, None),
        # Vor dem ersten gezaehlten Jahr.
        ("Boletus edulis", "emil", "2010-10-01", 40, 2010, 40, None),
        ("Imleria badia", "emil", "2010-10-01", 40, 2010, 40, None),
    ]
    rahmen = pd.DataFrame(
        zeilen,
        columns=["species", "recordedByHash", "date", "km", "iso_year", "iso_week",
                 "coordinateUncertaintyInMeters"],
    )
    rahmen["x"] = rahmen["km"] * 1000
    rahmen["y"] = rahmen["km"] * 1000
    rahmen["date"] = pd.to_datetime(rahmen["date"])
    return rahmen


def test_namen_decken_die_arten_der_app() -> None:
    namen = arten_namen()

    assert len(namen) == 85
    assert namen["Boletus edulis"] == "Steinpilz"


@pytest.mark.parametrize(
    ("besuche", "erwartet"),
    [(0, "Profil"), (59, "Profil"), (60, "Saison"), (599, "Saison"),
     (600, "Vorhersage"), (4000, "Vorhersage")],
)
def test_stufe_folgt_den_schwellen(besuche: int, erwartet: str) -> None:
    assert stufe(besuche) == erwartet


@pytest.mark.parametrize(
    ("letzter", "erwartet"),
    [
        # Ein Sonntag schliesst seine eigene Woche.
        (date(2026, 8, 23), (2026, 34)),
        # Ein Montag laesst nur die Woche davor voll sein.
        (date(2026, 8, 24), (2026, 34)),
        (date(2026, 8, 30), (2026, 35)),
    ],
)
def test_letzte_volle_woche(letzter: date, erwartet: tuple[int, int]) -> None:
    assert letzte_volle_woche(letzter) == erwartet


def test_woche_dreiundfuenfzig_faellt_in_woche_zweiundfuenfzig() -> None:
    reihe = wochenreihe(pd.Series({52: 3, 53: 4}))

    assert reihe[51] == 7
    assert len(reihe) == 52


def test_begehungen_brauchen_zwei_arten_und_eine_genaue_lage() -> None:
    besuche = begehungen_bilden(_occ())

    assert set(besuche["recordedByHash"]) == {"anna", "dora"}
    assert besuche["visit"].nunique() == 3


def test_tabelle_trennt_geschlossene_jahre_vom_laufenden() -> None:
    tabelle = saisontabelle(begehungen_bilden(_occ()), stand=STAND)

    assert tabelle["standJahr"] == 2026
    assert tabelle["bisJahr"] == 2025
    assert tabelle["vonJahr"] == 2024
    assert tabelle["begehungenJeWoche"][39] == 1
    assert tabelle["begehungenJeWoche"][40] == 1
    assert tabelle["begehungenJeWocheLaufendesJahr"][22] == 1


def test_tabelle_zaehlt_funde_je_art() -> None:
    arten = saisontabelle(begehungen_bilden(_occ()), stand=STAND)["arten"]

    assert arten["Boletus edulis"]["begehungenMitFund"] == 2
    assert arten["Boletus edulis"]["fundeJeWoche"][39] == 1
    assert arten["Boletus edulis"]["fundeJeWocheLaufendesJahr"][22] == 1
    assert arten["Imleria badia"]["begehungenMitFund"] == 3
    # Eine Art ohne Fund steht mit lauter Nullen in der Tabelle.
    assert arten["Morchella esculenta"]["begehungenMitFund"] == 0


def test_bericht_nennt_records_besuche_und_stufe() -> None:
    occ = _occ()
    zeilen = bericht(occ, begehungen_bilden(occ))

    assert list(zeilen.columns) == ["deutsch", "latein", "records", "besuche", "stufe"]
    assert len(zeilen) == 85
    steinpilz = zeilen[zeilen["latein"] == "Boletus edulis"].iloc[0]
    assert steinpilz["records"] == 5
    assert steinpilz["besuche"] == 2
    assert steinpilz["stufe"] == "Profil"


def test_main_schreibt_die_tabelle(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    quelle = tmp_path / "occurrences.parquet"
    _occ().to_parquet(quelle)
    ziel = tmp_path / "unter" / "saison.json"

    main(["--occurrences", str(quelle), "--tabelle", str(ziel), "--stand", "2026-08-24"])

    tabelle = json.loads(ziel.read_text(encoding="utf-8"))
    assert (tabelle["standJahr"], tabelle["standWoche"]) == STAND
    assert len(tabelle["arten"]) == 85
    assert "Stufen:" in capsys.readouterr().out


def test_main_berichtet_auch_ohne_ziel(tmp_path: Path,
                                       capsys: pytest.CaptureFixture[str]) -> None:
    quelle = tmp_path / "occurrences.parquet"
    _occ().to_parquet(quelle)

    main(["--occurrences", str(quelle)])

    assert "Vorhersage" not in capsys.readouterr().out.splitlines()[-1]
