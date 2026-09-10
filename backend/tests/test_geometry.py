"""Die Geometrie: Ring, Flaeche, Punkt in Flaeche, Rechteck, Raster.

Die Zahlen sind so gewaehlt, dass sie sich nachrechnen lassen: ein Grad Breite
sind 111,32 km, ein Quadrat von 0,1 Grad Breite und 0,1 Grad Laenge in
Deutschland ist rund 8200 Hektar gross.
"""

import pytest

from app.shared import geometry
from app.shared.geometry import (
    Point,
    area_ha,
    centroid,
    close_ring,
    grow_box,
    in_box,
    is_simple,
    point_in_polygon,
    read_box,
    ring_box,
    to_grid,
)

SQUARE: list[Point] = [(9.0, 48.0), (9.1, 48.0), (9.1, 48.1), (9.0, 48.1)]
CLOSED: list[Point] = [*SQUARE, SQUARE[0]]


# ------------------------------------------------------------------ Ring


def test_an_open_ring_gets_closed() -> None:
    assert close_ring(SQUARE) == CLOSED


def test_a_closed_ring_stays_as_it_is() -> None:
    assert close_ring(CLOSED) == CLOSED


@pytest.mark.parametrize(
    "points",
    [
        pytest.param([(9.0, 48.0)], id="ein-punkt"),
        pytest.param([(9.0, 48.0), (9.1, 48.0)], id="zwei-punkte"),
        pytest.param([(9.0, 48.0), (9.1, 48.0), (9.0, 48.0)], id="geschlossen-zu-kurz"),
    ],
)
def test_fewer_than_three_corners_are_no_area(points: list[Point]) -> None:
    with pytest.raises(ValueError, match="mindestens 3 Eckpunkte"):
        _ = close_ring(points)


def test_a_repeated_corner_is_caught() -> None:
    with pytest.raises(ValueError, match="zweimal"):
        _ = close_ring([(9.0, 48.0), (9.1, 48.0), (9.0, 48.0), (9.1, 48.1)])


def test_a_square_does_not_intersect_itself() -> None:
    assert is_simple(CLOSED) is True


def test_a_loop_intersects_itself() -> None:
    # Die Ecken ueber Kreuz gezogen: aus dem Quadrat wird eine Acht.
    loop = close_ring([(9.0, 48.0), (9.1, 48.1), (9.1, 48.0), (9.0, 48.1)])

    assert is_simple(loop) is False


# ------------------------------------------------------------------ Flaeche


def test_area_of_a_square_in_hectares() -> None:
    computed = area_ha(CLOSED)

    # 0,1 Grad Breite sind 11,132 km, 0,1 Grad Laenge auf 48 Grad rund 7,44 km.
    assert computed == pytest.approx(8280.0, rel=0.01)


def test_the_ring_direction_does_not_change_the_area() -> None:
    backwards = close_ring(list(reversed(SQUARE)))

    assert area_ha(backwards) == pytest.approx(area_ha(CLOSED))


def test_the_centroid_of_a_square_is_its_middle() -> None:
    lon, width = centroid(CLOSED)

    assert (lon, width) == pytest.approx((9.05, 48.05))


# ------------------------------------------------------------------ Punkt in Flaeche


@pytest.mark.parametrize(
    ("point", "expected"),
    [
        pytest.param((9.05, 48.05), True, id="mitte"),
        pytest.param((8.9, 48.05), False, id="westlich"),
        pytest.param((9.2, 48.05), False, id="oestlich"),
        pytest.param((9.05, 47.9), False, id="suedlich"),
        pytest.param((9.05, 48.2), False, id="noerdlich"),
    ],
)
def test_point_in_polygon(point: Point, *, expected: bool) -> None:
    assert point_in_polygon(point, CLOSED) is expected


def test_a_point_in_a_concave_polygon() -> None:
    # Ein L: die Kerbe rechts oben gehoert nicht mehr dazu.
    ell = close_ring(
        [(9.0, 48.0), (9.2, 48.0), (9.2, 48.05), (9.1, 48.05), (9.1, 48.2), (9.0, 48.2)]
    )

    assert point_in_polygon((9.05, 48.1), ell) is True
    assert point_in_polygon((9.15, 48.1), ell) is False


# ------------------------------------------------------------------ Rechteck


def test_ring_box_encloses_every_corner() -> None:
    assert ring_box(CLOSED) == (9.0, 48.0, 9.1, 48.1)


@pytest.mark.parametrize(
    ("point", "expected"),
    [
        pytest.param((9.05, 48.05), True, id="innen"),
        pytest.param((9.0, 48.0), True, id="auf-der-ecke"),
        pytest.param((8.9, 48.05), False, id="westlich"),
        pytest.param((9.2, 48.05), False, id="oestlich"),
        pytest.param((9.05, 47.9), False, id="suedlich"),
        pytest.param((9.05, 48.2), False, id="noerdlich"),
    ],
)
def test_in_box(point: Point, *, expected: bool) -> None:
    assert in_box(point, (9.0, 48.0, 9.1, 48.1)) is expected


def test_grow_box_adds_a_margin_on_every_side() -> None:
    assert grow_box((9.0, 48.0, 9.1, 48.1), 0.5) == pytest.approx((8.5, 47.5, 9.6, 48.6))


def test_read_box_takes_four_numbers() -> None:
    assert read_box("9.0,48.0,9.1,48.1") == (9.0, 48.0, 9.1, 48.1)


@pytest.mark.parametrize(
    ("text", "message"),
    [
        pytest.param("9.0,48.0,9.1", "vier Zahlen", id="zu-wenig"),
        pytest.param("9.0,48.0,9.1,48.1,3", "vier Zahlen", id="zu-viel"),
        pytest.param("west,48.0,9.1,48.1", "vier Zahlen", id="keine-zahl"),
        pytest.param("9.2,48.0,9.1,48.1", "suedwestlich", id="osten-vor-westen"),
        pytest.param("9.0,48.2,9.1,48.1", "suedwestlich", id="norden-vor-sueden"),
    ],
)
def test_read_box_rejects_nonsense(text: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        _ = read_box(text)


# ------------------------------------------------------------------ Raster


def test_the_grid_puts_a_point_on_a_node() -> None:
    coarse = to_grid((9.0511, 48.5203), 5.0)

    assert coarse != (9.0511, 48.5203)
    # Weiter als eine halbe Masche verschiebt das Runden nie.
    assert abs(coarse[1] - 48.5203) <= 5.0 / geometry.KM_PER_LAT_DEGREE / 2 + 1e-6


def test_two_nearby_points_land_on_the_same_node() -> None:
    # 200 Meter auseinander: im 5-km-Raster derselbe Knoten.
    assert to_grid((9.0511, 48.5203), 5.0) == to_grid((9.0538, 48.5221), 5.0)
