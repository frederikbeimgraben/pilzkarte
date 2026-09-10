"""Zonen: Flaeche, Eckpunkte, Besitz und der Wert aus den Kacheln.

Die Zone der Vorrichtung ist ein Rechteck von 0,03 Grad Laenge und 0,02 Grad
Breite bei 48,53 Grad Nord. Das sind 2,21 km mal 2,23 km, also rund 492 Hektar.
Auf Zoom 8 ist ein Kachelpunkt in Deutschland gut 600 m breit, die Zone deckt
darum ein paar Punkte der Kachel 134/88 ab.
"""

from typing import Any

import httpx
import pytest

from tests.conftest import FalscherIdp
from tests.objekte import karte_schreiben, maps_ordner, polygon, zone_koerper
from tests.test_funde import EIGEN, FREMD, als, fund_anlegen

ZOOM = 8
KACHEL_X = 134
KACHEL_Y = 88
# Die Kachelpunkte, unter denen die Zone der Vorrichtung liegt.
BEREICH = [(x, y) for x in range(110, 119) for y in range(104, 113)]
# Der Punkt unter dem Schwerpunkt der Zone.
MITTE = (114, 108)

WINZIG = [[9.0650, 48.5300], [9.0651, 48.5300], [9.0651, 48.5301], [9.0650, 48.5301]]


async def zone_anlegen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    sub: str = EIGEN,
    **abweichung: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt eine Zone an und liefert die Antwort."""
    antwort = await ruf.post("/api/zonen", json=zone_koerper(**abweichung), headers=als(idp, sub))
    assert antwort.status_code == 201, antwort.text
    return antwort.json()


def karte(
    stufe: int,
    punkte: list[tuple[int, int]] | None = None,
    kachel_x: int = KACHEL_X,
    kachel_y: int = KACHEL_Y,
) -> None:
    """Schreibt Manifest und Kachel fuer den Steinpilz unter PILZE_MAPS."""
    karte_schreiben(
        maps_ordner(),
        stufen=dict.fromkeys(punkte if punkte is not None else BEREICH, stufe),
        kachel_x=kachel_x,
        kachel_y=kachel_y,
        zoom=ZOOM,
    )


async def wert(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    zone_id: str,
    art: str = "steinpilz",
    jahr: int = 2026,
    woche: int = 40,
    sub: str = EIGEN,
) -> httpx.Response:
    """Fragt den Zonenwert ab."""
    return await ruf.get(
        f"/api/zonen/{zone_id}/wert?art={art}&jahr={jahr}&woche={woche}",
        headers=als(idp, sub),
    )


# ------------------------------------------------------------------ Anlegen und Flaeche


async def test_ohne_token_gibt_es_keine_zonen(ruf: httpx.AsyncClient) -> None:
    async with ruf:
        antwort = await ruf.get("/api/zonen")

    assert antwort.status_code == 401


async def test_der_dienst_rechnet_die_flaeche_und_schliesst_den_ring(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)

    ring = angelegt["polygon"]["coordinates"][0]
    assert ring[0] == ring[-1]
    assert len(ring) == 5
    assert angelegt["flaecheHa"] == pytest.approx(492.0, rel=0.01)


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
async def test_ein_unmoegliches_polygon_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    ring: list[list[float]],
    id_: str,
) -> None:
    async with ruf:
        antwort = await ruf.post(
            "/api/zonen",
            json=zone_koerper(polygon=polygon(ring)),
            headers=als(idp),
        )

    assert antwort.status_code == 422, id_


async def test_ein_polygon_mit_loch_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    zwei_ringe = {
        "type": "Polygon",
        "coordinates": [
            [[9.05, 48.52], [9.08, 48.52], [9.08, 48.54]],
            [[9.06, 48.525], [9.07, 48.525], [9.07, 48.535]],
        ],
    }
    async with ruf:
        antwort = await ruf.post(
            "/api/zonen",
            json=zone_koerper(polygon=zwei_ringe),
            headers=als(idp),
        )

    assert antwort.status_code == 422


async def test_neue_eckpunkte_rechnen_die_flaeche_neu(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        geaendert = await ruf.patch(
            f"/api/zonen/{angelegt['id']}",
            json={"polygon": polygon(WINZIG)},
            headers=als(idp),
        )

    assert geaendert.json()["flaecheHa"] < angelegt["flaecheHa"]


async def test_eine_zone_laesst_sich_umbenennen(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        geaendert = await ruf.patch(
            f"/api/zonen/{angelegt['id']}",
            json={"name": "Schoenbuch Sued", "farbe": "gold"},
            headers=als(idp),
        )

    koerper = geaendert.json()
    assert koerper["name"] == "Schoenbuch Sued"
    assert koerper["farbe"] == "gold"
    assert koerper["flaecheHa"] == angelegt["flaecheHa"]


async def test_die_liste_zeigt_nur_die_eigenen_zonen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await zone_anlegen(ruf, idp)
        _ = await zone_anlegen(ruf, idp, sub=FREMD)
        meine = await ruf.get("/api/zonen?limit=10", headers=als(idp))

    assert meine.json()["gesamt"] == 1
    assert meine.json()["eintraege"][0]["name"] == "Schoenbuch Nord"


async def test_eine_zone_laesst_sich_loeschen(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        geloescht = await ruf.delete(f"/api/zonen/{angelegt['id']}", headers=als(idp))
        nachher = await ruf.get(f"/api/zonen/{angelegt['id']}", headers=als(idp))

    assert geloescht.status_code == 204
    assert nachher.status_code == 404


@pytest.mark.parametrize("verb", ["get", "patch", "delete"])
async def test_eine_fremde_zone_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    verb: str,
) -> None:
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        pfad = f"/api/zonen/{angelegt['id']}"
        if verb == "patch":
            antwort = await ruf.patch(pfad, json={"name": "fremd"}, headers=als(idp, FREMD))
        else:
            antwort = await ruf.request(verb.upper(), pfad, headers=als(idp, FREMD))

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "not_found"


async def test_der_wert_einer_fremden_zone_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    karte(128)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"], sub=FREMD)

    assert antwort.status_code == 404


# ------------------------------------------------------------------ Zonenwert


async def test_der_zonenwert_mittelt_die_kachelpunkte(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    # Byte 128 heisst (128 - 1) / 254 = 0,5 vom Hoechstwert. Bei top = 0,5 sind
    # das 0,25 je Begehung, also 25 Prozent.
    karte(128)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"])

    koerper = antwort.json()
    assert antwort.status_code == 200
    assert koerper["flaechenmittel"] == pytest.approx(25.0)
    assert koerper["punkte"] >= 9
    assert koerper["art"] == "steinpilz"
    assert koerper["woche"] == {"jahr": 2026, "woche": 40}


async def test_punkte_ohne_daten_zaehlen_nicht(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    # Eine Kachel voller Nullen heisst: die Kette hat hier nichts gerechnet.
    karte(0)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"])

    koerper = antwort.json()
    assert koerper["punkte"] == 0
    assert koerper["flaechenmittel"] == 0.0


async def test_eine_kachel_ausserhalb_des_manifests_wird_nicht_gesucht(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    # Das Manifest fuehrt eine andere Kachel. Der Dienst fragt die Platte gar
    # nicht erst, statt an einer fehlenden Datei zu scheitern.
    karte(200, kachel_x=999, kachel_y=999)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"])

    assert antwort.json()["punkte"] == 0


async def test_eine_zone_kleiner_als_ein_kachelpunkt_bekommt_ihre_zelle(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    # Byte 255 ist der Hoechstwert der Art: 1,0 mal top 0,5 sind 50 Prozent.
    karte(255, punkte=[MITTE])
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp, polygon=polygon(WINZIG))
        antwort = await wert(ruf, idp, angelegt["id"])

    koerper = antwort.json()
    assert koerper["punkte"] == 1
    assert koerper["flaechenmittel"] == pytest.approx(50.0)


async def test_eigene_funde_in_der_zone_werden_gezaehlt(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    karte(128)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        _ = await fund_anlegen(ruf, idp, lat=48.53, lon=9.06)
        _ = await fund_anlegen(ruf, idp, lat=48.53, lon=9.07, artSlug="parasol")
        # Ausserhalb der Zone und ein fremder Fund darin: beide zaehlen nicht.
        _ = await fund_anlegen(ruf, idp, lat=48.60, lon=9.06)
        _ = await fund_anlegen(ruf, idp, lat=48.53, lon=9.065, sub=FREMD)
        antwort = await wert(ruf, idp, angelegt["id"])

    assert antwort.json()["eigeneFunde"] == 2


async def test_ohne_manifest_gibt_es_keinen_wert(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"])

    assert antwort.status_code == 404
    assert "PILZE_MAPS" in antwort.json()["detail"]


async def test_eine_woche_ohne_kacheln_gibt_es_nicht(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    karte(128)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"], woche=41)

    assert antwort.status_code == 404
    assert "keine Woche 2026-41" in antwort.json()["detail"]


async def test_eine_art_ohne_vorhersagekarte_gibt_keinen_wert(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    karte(128)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"], art="parasol")

    assert antwort.status_code == 404
    assert "keine Vorhersagekarte" in antwort.json()["detail"]


async def test_eine_art_ausserhalb_des_katalogs_gibt_keinen_wert(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    karte(128)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"], art="gibt-es-nicht")

    assert antwort.status_code == 404


async def test_eine_unmoegliche_woche_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    karte(128)
    async with ruf:
        angelegt = await zone_anlegen(ruf, idp)
        antwort = await wert(ruf, idp, angelegt["id"], woche=54)

    assert antwort.status_code == 422
