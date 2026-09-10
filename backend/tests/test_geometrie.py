"""Die Geometrie: Ring, Flaeche, Punkt in Flaeche, Rechteck, Raster.

Die Zahlen sind so gewaehlt, dass sie sich nachrechnen lassen: ein Grad Breite
sind 111,32 km, ein Quadrat von 0,1 Grad Breite und 0,1 Grad Laenge in
Deutschland ist rund 8200 Hektar gross.
"""

import pytest

from app.shared import geometrie
from app.shared.geometrie import (
    Punkt,
    auf_raster,
    flaeche_ha,
    im_rechteck,
    ist_einfach,
    punkt_in_polygon,
    rechteck_erweitern,
    rechteck_lesen,
    ring_normieren,
    ring_rechteck,
    schwerpunkt,
)

QUADRAT: list[Punkt] = [(9.0, 48.0), (9.1, 48.0), (9.1, 48.1), (9.0, 48.1)]
GESCHLOSSEN: list[Punkt] = [*QUADRAT, QUADRAT[0]]


# ------------------------------------------------------------------ Ring


def test_offener_ring_wird_geschlossen() -> None:
    assert ring_normieren(QUADRAT) == GESCHLOSSEN


def test_geschlossener_ring_bleibt_wie_er_ist() -> None:
    assert ring_normieren(GESCHLOSSEN) == GESCHLOSSEN


@pytest.mark.parametrize(
    "punkte",
    [
        pytest.param([(9.0, 48.0)], id="ein-punkt"),
        pytest.param([(9.0, 48.0), (9.1, 48.0)], id="zwei-punkte"),
        pytest.param([(9.0, 48.0), (9.1, 48.0), (9.0, 48.0)], id="geschlossen-zu-kurz"),
    ],
)
def test_weniger_als_drei_ecken_sind_keine_flaeche(punkte: list[Punkt]) -> None:
    with pytest.raises(ValueError, match="mindestens 3 Eckpunkte"):
        _ = ring_normieren(punkte)


def test_ein_doppelter_eckpunkt_faellt_auf() -> None:
    with pytest.raises(ValueError, match="zweimal"):
        _ = ring_normieren([(9.0, 48.0), (9.1, 48.0), (9.0, 48.0), (9.1, 48.1)])


def test_ein_quadrat_ueberschneidet_sich_nicht() -> None:
    assert ist_einfach(GESCHLOSSEN) is True


def test_eine_schleife_ueberschneidet_sich() -> None:
    # Die Ecken ueber Kreuz gezogen: aus dem Quadrat wird eine Acht.
    schleife = ring_normieren([(9.0, 48.0), (9.1, 48.1), (9.1, 48.0), (9.0, 48.1)])

    assert ist_einfach(schleife) is False


# ------------------------------------------------------------------ Flaeche


def test_flaeche_eines_quadrats_in_hektar() -> None:
    gerechnet = flaeche_ha(GESCHLOSSEN)

    # 0,1 Grad Breite sind 11,132 km, 0,1 Grad Laenge auf 48 Grad rund 7,44 km.
    assert gerechnet == pytest.approx(8280.0, rel=0.01)


def test_die_richtung_des_rings_aendert_die_flaeche_nicht() -> None:
    rueckwaerts = ring_normieren(list(reversed(QUADRAT)))

    assert flaeche_ha(rueckwaerts) == pytest.approx(flaeche_ha(GESCHLOSSEN))


def test_der_schwerpunkt_eines_quadrats_ist_seine_mitte() -> None:
    laenge, breite = schwerpunkt(GESCHLOSSEN)

    assert (laenge, breite) == pytest.approx((9.05, 48.05))


# ------------------------------------------------------------------ Punkt in Flaeche


@pytest.mark.parametrize(
    ("punkt", "erwartet"),
    [
        pytest.param((9.05, 48.05), True, id="mitte"),
        pytest.param((8.9, 48.05), False, id="westlich"),
        pytest.param((9.2, 48.05), False, id="oestlich"),
        pytest.param((9.05, 47.9), False, id="suedlich"),
        pytest.param((9.05, 48.2), False, id="noerdlich"),
    ],
)
def test_punkt_in_polygon(punkt: Punkt, *, erwartet: bool) -> None:
    assert punkt_in_polygon(punkt, GESCHLOSSEN) is erwartet


def test_punkt_in_einem_konkaven_polygon() -> None:
    # Ein L: die Kerbe rechts oben gehoert nicht mehr dazu.
    ell = ring_normieren(
        [(9.0, 48.0), (9.2, 48.0), (9.2, 48.05), (9.1, 48.05), (9.1, 48.2), (9.0, 48.2)]
    )

    assert punkt_in_polygon((9.05, 48.1), ell) is True
    assert punkt_in_polygon((9.15, 48.1), ell) is False


# ------------------------------------------------------------------ Rechteck


def test_ring_rechteck_umschliesst_alle_ecken() -> None:
    assert ring_rechteck(GESCHLOSSEN) == (9.0, 48.0, 9.1, 48.1)


@pytest.mark.parametrize(
    ("punkt", "erwartet"),
    [
        pytest.param((9.05, 48.05), True, id="innen"),
        pytest.param((9.0, 48.0), True, id="auf-der-ecke"),
        pytest.param((8.9, 48.05), False, id="westlich"),
        pytest.param((9.2, 48.05), False, id="oestlich"),
        pytest.param((9.05, 47.9), False, id="suedlich"),
        pytest.param((9.05, 48.2), False, id="noerdlich"),
    ],
)
def test_im_rechteck(punkt: Punkt, *, erwartet: bool) -> None:
    assert im_rechteck(punkt, (9.0, 48.0, 9.1, 48.1)) is erwartet


def test_rechteck_erweitern_legt_einen_rand_um_alle_seiten() -> None:
    assert rechteck_erweitern((9.0, 48.0, 9.1, 48.1), 0.5) == pytest.approx((8.5, 47.5, 9.6, 48.6))


def test_rechteck_lesen_nimmt_vier_zahlen() -> None:
    assert rechteck_lesen("9.0,48.0,9.1,48.1") == (9.0, 48.0, 9.1, 48.1)


@pytest.mark.parametrize(
    ("text", "meldung"),
    [
        pytest.param("9.0,48.0,9.1", "vier Zahlen", id="zu-wenig"),
        pytest.param("9.0,48.0,9.1,48.1,3", "vier Zahlen", id="zu-viel"),
        pytest.param("west,48.0,9.1,48.1", "vier Zahlen", id="keine-zahl"),
        pytest.param("9.2,48.0,9.1,48.1", "suedwestlich", id="osten-vor-westen"),
        pytest.param("9.0,48.2,9.1,48.1", "suedwestlich", id="norden-vor-sueden"),
    ],
)
def test_rechteck_lesen_weist_unsinn_ab(text: str, meldung: str) -> None:
    with pytest.raises(ValueError, match=meldung):
        _ = rechteck_lesen(text)


# ------------------------------------------------------------------ Raster


def test_raster_legt_einen_punkt_auf_einen_knoten() -> None:
    grob = auf_raster((9.0511, 48.5203), 5.0)

    assert grob != (9.0511, 48.5203)
    # Weiter als eine halbe Masche verschiebt das Runden nie.
    assert abs(grob[1] - 48.5203) <= 5.0 / geometrie.KM_JE_BREITENGRAD / 2 + 1e-6


def test_zwei_nahe_punkte_landen_auf_demselben_knoten() -> None:
    # 200 Meter auseinander: im 5-km-Raster derselbe Knoten.
    assert auf_raster((9.0511, 48.5203), 5.0) == auf_raster((9.0538, 48.5221), 5.0)
