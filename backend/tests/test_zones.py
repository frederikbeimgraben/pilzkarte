"""Zonen: Flaeche, Eckpunkte, Besitz und der Wert aus den Kacheln.

Die Zone der Vorrichtung ist ein Rechteck von 0,03 Grad Laenge und 0,02 Grad
Breite bei 48,53 Grad Nord. Das sind 2,21 km mal 2,23 km, also rund 492 Hektar.
Auf Zoom 8 ist ein Kachelpunkt in Deutschland gut 600 m breit, die Zone deckt
darum ein paar Punkte der Kachel 134/88 ab.
"""

from typing import Any

import httpx
import pytest

from tests.conftest import FakeIdp
from tests.objects import maps_folder, polygon, write_map, zone_body
from tests.test_finds import OTHER, OWN, as_user, create_find

ZOOM = 8
TILE_X = 134
TILE_Y = 88
# Die Kachelpunkte, unter denen die Zone der Vorrichtung liegt.
AREA = [(x, y) for x in range(110, 119) for y in range(104, 113)]
# Der Punkt unter dem Schwerpunkt der Zone.
CENTRE = (114, 108)

TINY = [[9.0650, 48.5300], [9.0651, 48.5300], [9.0651, 48.5301], [9.0650, 48.5301]]


async def create_zone(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    sub: str = OWN,
    **override: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt eine Zone an und liefert die Antwort."""
    response = await call.post("/api/zonen", json=zone_body(**override), headers=as_user(idp, sub))
    assert response.status_code == 201, response.text
    return response.json()


def map_name(
    tier: int,
    points: list[tuple[int, int]] | None = None,
    tile_x: int = TILE_X,
    tile_y: int = TILE_Y,
) -> None:
    """Schreibt Manifest und Kachel fuer den Steinpilz unter PILZE_MAPS."""
    write_map(
        maps_folder(),
        levels=dict.fromkeys(points if points is not None else AREA, tier),
        tile_x=tile_x,
        tile_y=tile_y,
        zoom=ZOOM,
    )


async def value(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    zone_id: str,
    species: str = "steinpilz",
    year: int = 2026,
    week: int = 40,
    sub: str = OWN,
) -> httpx.Response:
    """Fragt den Zonenwert ab."""
    return await call.get(
        f"/api/zonen/{zone_id}/wert?art={species}&jahr={year}&woche={week}",
        headers=as_user(idp, sub),
    )


# ------------------------------------------------------------------ Anlegen und Flaeche


async def test_without_a_token_there_are_no_zones(call: httpx.AsyncClient) -> None:
    async with call:
        response = await call.get("/api/zonen")

    assert response.status_code == 401


async def test_the_service_computes_the_area_and_closes_the_ring(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_zone(call, idp)

    ring = created["polygon"]["coordinates"][0]
    assert ring[0] == ring[-1]
    assert len(ring) == 5
    assert created["flaecheHa"] == pytest.approx(492.0, rel=0.01)


@pytest.mark.parametrize(
    ("ring", "id_"),
    [
        pytest.param([[9.05, 48.52], [9.08, 48.52]], "zwei-punkte", id="zu-kurz"),
        pytest.param(
            [[9.05, 48.52], [9.08, 48.54], [9.08, 48.52], [9.05, 48.54]],
            "schleife",
            id="ueberschneidung",
        ),
        pytest.param(
            [[9.05, 48.52], [9.06, 48.52], [9.07, 48.52]],
            "linie",
            id="ohne-flaeche",
        ),
        pytest.param(
            [[12.4, 41.9], [12.5, 41.9], [12.5, 42.0]],
            "rom",
            id="ausserhalb-deutschlands",
        ),
    ],
)
async def test_an_impossible_polygon_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    ring: list[list[float]],
    id_: str,
) -> None:
    async with call:
        response = await call.post(
            "/api/zonen",
            json=zone_body(polygon=polygon(ring)),
            headers=as_user(idp),
        )

    assert response.status_code == 422, id_


async def test_a_polygon_with_a_hole_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    two_rings = {
        "type": "Polygon",
        "coordinates": [
            [[9.05, 48.52], [9.08, 48.52], [9.08, 48.54]],
            [[9.06, 48.525], [9.07, 48.525], [9.07, 48.535]],
        ],
    }
    async with call:
        response = await call.post(
            "/api/zonen",
            json=zone_body(polygon=two_rings),
            headers=as_user(idp),
        )

    assert response.status_code == 422


async def test_new_corners_recompute_the_area(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_zone(call, idp)
        patched = await call.patch(
            f"/api/zonen/{created['id']}",
            json={"polygon": polygon(TINY)},
            headers=as_user(idp),
        )

    assert patched.json()["flaecheHa"] < created["flaecheHa"]


async def test_a_zone_can_be_renamed(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_zone(call, idp)
        patched = await call.patch(
            f"/api/zonen/{created['id']}",
            json={"name": "Schoenbuch Sued", "farbe": "gold"},
            headers=as_user(idp),
        )

    body = patched.json()
    assert body["name"] == "Schoenbuch Sued"
    assert body["farbe"] == "gold"
    assert body["flaecheHa"] == created["flaecheHa"]


async def test_the_listing_shows_only_own_zones(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_zone(call, idp)
        _ = await create_zone(call, idp, sub=OTHER)
        mine = await call.get("/api/zonen?limit=10", headers=as_user(idp))

    assert mine.json()["gesamt"] == 1
    assert mine.json()["eintraege"][0]["name"] == "Schoenbuch Nord"


async def test_a_zone_can_be_deleted(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_zone(call, idp)
        deleted = await call.delete(f"/api/zonen/{created['id']}", headers=as_user(idp))
        afterwards = await call.get(f"/api/zonen/{created['id']}", headers=as_user(idp))

    assert deleted.status_code == 204
    assert afterwards.status_code == 404


@pytest.mark.parametrize("verb", ["get", "patch", "delete"])
async def test_another_persons_zone_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    verb: str,
) -> None:
    async with call:
        created = await create_zone(call, idp)
        path = f"/api/zonen/{created['id']}"
        if verb == "patch":
            response = await call.patch(path, json={"name": "fremd"}, headers=as_user(idp, OTHER))
        else:
            response = await call.request(verb.upper(), path, headers=as_user(idp, OTHER))

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_the_value_of_another_persons_zone_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    map_name(128)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"], sub=OTHER)

    assert response.status_code == 404


# ------------------------------------------------------------------ Zonenwert


async def test_the_zone_value_averages_the_tile_points(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Byte 128 heisst (128 - 1) / 254 = 0,5 vom Hoechstwert. Bei top = 0,5 sind
    # das 0,25 je Begehung, also 25 Prozent.
    map_name(128)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"])

    body = response.json()
    assert response.status_code == 200
    assert body["flaechenmittel"] == pytest.approx(25.0)
    assert body["punkte"] >= 9
    assert body["art"] == "steinpilz"
    assert body["woche"] == {"jahr": 2026, "woche": 40}


async def test_points_without_data_do_not_count(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Eine Kachel voller Nullen heisst: die Kette hat hier nichts gerechnet.
    map_name(0)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"])

    body = response.json()
    assert body["punkte"] == 0
    assert body["flaechenmittel"] == 0.0


async def test_a_tile_outside_the_manifest_is_not_looked_for(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Das Manifest fuehrt eine andere Kachel. Der Dienst fragt die Platte gar
    # nicht erst, statt an einer fehlenden Datei zu scheitern.
    map_name(200, tile_x=999, tile_y=999)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"])

    assert response.json()["punkte"] == 0


async def test_a_zone_smaller_than_a_tile_point_gets_its_cell(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Byte 255 ist der Hoechstwert der Art: 1,0 mal top 0,5 sind 50 Prozent.
    map_name(255, points=[CENTRE])
    async with call:
        created = await create_zone(call, idp, polygon=polygon(TINY))
        response = await value(call, idp, created["id"])

    body = response.json()
    assert body["punkte"] == 1
    assert body["flaechenmittel"] == pytest.approx(50.0)


async def test_own_finds_inside_the_zone_are_counted(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    map_name(128)
    async with call:
        created = await create_zone(call, idp)
        _ = await create_find(call, idp, lat=48.53, lon=9.06)
        _ = await create_find(call, idp, lat=48.53, lon=9.07, artSlug="parasol")
        # Ausserhalb der Zone und ein fremder Fund darin: beide zaehlen nicht.
        _ = await create_find(call, idp, lat=48.60, lon=9.06)
        _ = await create_find(call, idp, lat=48.53, lon=9.065, sub=OTHER)
        response = await value(call, idp, created["id"])

    assert response.json()["eigeneFunde"] == 2


async def test_without_a_manifest_there_is_no_value(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"])

    assert response.status_code == 404
    assert "PILZE_MAPS" in response.json()["detail"]


async def test_a_week_without_tiles_does_not_exist(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    map_name(128)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"], week=41)

    assert response.status_code == 404
    assert "keine Woche 2026-41" in response.json()["detail"]


async def test_a_species_without_a_forecast_map_gives_no_value(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    map_name(128)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"], species="parasol")

    assert response.status_code == 404
    assert "keine Vorhersagekarte" in response.json()["detail"]


async def test_a_species_outside_the_catalog_gives_no_value(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    map_name(128)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"], species="gibt-es-nicht")

    assert response.status_code == 404


async def test_an_impossible_week_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    map_name(128)
    async with call:
        created = await create_zone(call, idp)
        response = await value(call, idp, created["id"], week=54)

    assert response.status_code == 422
