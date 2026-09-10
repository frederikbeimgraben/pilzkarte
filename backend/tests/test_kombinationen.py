"""Gespeicherte Kombinationen: Faktoren, Quellen, Besitz.

Die Vorrichtung legt drei Ebenen unter PILZE_MAPS ab. Der Testkatalog kennt
dazu die Wertkarte ``boletus_edulis``. Alles andere ist keine Quelle.
"""

from typing import Any

import httpx
import pytest

from app.modules.kombinationen import quellen
from tests.conftest import FalscherIdp
from tests.objekte import ebenen_schreiben, kombination_koerper, maps_ordner
from tests.test_funde import EIGEN, FREMD, als


def ebenen(namen: list[str] | None = None) -> None:
    """Schreibt layers.json und leert den Zwischenspeicher des Prozesses."""
    quellen.ebenennamen.cache_clear()
    ebenen_schreiben(maps_ordner(), namen)


async def anlegen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    sub: str = EIGEN,
    **abweichung: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt eine Kombination an und liefert die Antwort."""
    antwort = await ruf.post(
        "/api/kombinationen",
        json=kombination_koerper(**abweichung),
        headers=als(idp, sub),
    )
    assert antwort.status_code == 201, antwort.text
    return antwort.json()


# ------------------------------------------------------------------ Anlegen und Lesen


async def test_ohne_token_gibt_es_keine_kombinationen(ruf: httpx.AsyncClient) -> None:
    async with ruf:
        antwort = await ruf.get("/api/kombinationen")

    assert antwort.status_code == 401
    assert antwort.headers["content-type"].startswith("application/problem+json")


async def test_eine_kombination_kommt_mit_ihren_faktoren_zurueck(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(ruf, idp)
        gelesen = await ruf.get(f"/api/kombinationen/{angelegt['id']}", headers=als(idp))

    koerper = gelesen.json()
    assert koerper["name"] == "Nasser Buchenhang"
    assert koerper["regel"] == "schnitt"
    assert koerper["faktoren"] == [
        {"quelle": "regen_4w", "bedingung": "ueber", "von": 80.0, "bis": None, "aktiv": True},
        {"quelle": "temperatur", "bedingung": "zwischen", "von": 8.0, "bis": 16.0, "aktiv": True},
        {"quelle": "hangneigung", "bedingung": "unter", "von": None, "bis": 15.0, "aktiv": False},
    ]
    assert "besitzerSub" not in koerper


async def test_eine_wertkarte_des_katalogs_ist_auch_eine_quelle(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(
            ruf,
            idp,
            faktoren=[{"quelle": "boletus_edulis", "bedingung": "ueber", "von": 0.1}],
        )

    assert angelegt["faktoren"][0]["quelle"] == "boletus_edulis"


async def test_ohne_layers_json_bleiben_nur_die_wertkarten(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    quellen.ebenennamen.cache_clear()
    async with ruf:
        mit_karte = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(
                faktoren=[{"quelle": "boletus_edulis", "bedingung": "ueber", "von": 0.1}],
            ),
            headers=als(idp),
        )
        mit_ebene = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(),
            headers=als(idp),
        )

    assert mit_karte.status_code == 201
    assert mit_ebene.status_code == 422


async def test_die_regel_hat_eine_vorgabe(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    ebenen()
    koerper = kombination_koerper()
    del koerper["regel"]
    async with ruf:
        antwort = await ruf.post("/api/kombinationen", json=koerper, headers=als(idp))

    assert antwort.json()["regel"] == "schnitt"


async def test_abgestuft_ist_die_zweite_regel(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(ruf, idp, regel="abgestuft")

    assert angelegt["regel"] == "abgestuft"


async def test_eine_dritte_regel_gibt_es_nicht(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    ebenen()
    async with ruf:
        antwort = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(regel="vereinigung"),
            headers=als(idp),
        )

    assert antwort.status_code == 422


# ------------------------------------------------------------------ Faktoren


@pytest.mark.parametrize(
    ("faktor", "meldung"),
    [
        pytest.param(
            {"quelle": "temperatur", "bedingung": "zwischen", "von": 16, "bis": 8},
            "von nicht ueber bis",
            id="von-ueber-bis",
        ),
        pytest.param(
            {"quelle": "temperatur", "bedingung": "zwischen", "von": 8},
            "braucht von und bis",
            id="zwischen-ohne-bis",
        ),
        pytest.param(
            {"quelle": "temperatur", "bedingung": "ueber"},
            "braucht von",
            id="ueber-ohne-von",
        ),
        pytest.param(
            {"quelle": "temperatur", "bedingung": "ueber", "von": 8, "bis": 16},
            "kennt kein bis",
            id="ueber-mit-bis",
        ),
        pytest.param(
            {"quelle": "temperatur", "bedingung": "unter"},
            "braucht bis",
            id="unter-ohne-bis",
        ),
        pytest.param(
            {"quelle": "temperatur", "bedingung": "unter", "von": 8, "bis": 16},
            "kennt kein von",
            id="unter-mit-von",
        ),
        pytest.param(
            {"quelle": "temperatur", "bedingung": "haeufig", "von": 8},
            "",
            id="bedingung-gibt-es-nicht",
        ),
        pytest.param(
            {"quelle": "Temperatur!", "bedingung": "ueber", "von": 8},
            "",
            id="quelle-in-falscher-form",
        ),
    ],
)
async def test_ein_faktor_ausserhalb_der_regeln(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    faktor: dict[str, Any],
    meldung: str,
) -> None:
    ebenen()
    async with ruf:
        antwort = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(faktoren=[faktor]),
            headers=als(idp),
        )

    assert antwort.status_code == 422
    assert meldung in antwort.text


async def test_eine_unbekannte_quelle_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        antwort = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(
                faktoren=[
                    {"quelle": "mondphase", "bedingung": "ueber", "von": 1},
                    {"quelle": "regen_4w", "bedingung": "ueber", "von": 80},
                ],
            ),
            headers=als(idp),
        )

    assert antwort.status_code == 422
    assert antwort.json()["detail"] == "Diese Quellen gibt es nicht: mondphase."


async def test_ohne_faktor_gibt_es_nichts_zu_zeigen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        antwort = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(faktoren=[]),
            headers=als(idp),
        )

    assert antwort.status_code == 422


async def test_hoechstens_acht_faktoren(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    ebenen([f"ebene_{nummer}" for nummer in range(9)])
    faktoren = [
        {"quelle": f"ebene_{nummer}", "bedingung": "ueber", "von": 1.0} for nummer in range(9)
    ]
    async with ruf:
        zu_viel = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(faktoren=faktoren),
            headers=als(idp),
        )
        gerade_genug = await ruf.post(
            "/api/kombinationen",
            json=kombination_koerper(faktoren=faktoren[:8]),
            headers=als(idp),
        )

    assert zu_viel.status_code == 422
    assert gerade_genug.status_code == 201


# ------------------------------------------------------------------ Liste, Aendern, Loeschen


async def test_die_liste_zeigt_nur_die_eigenen_kombinationen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        _ = await anlegen(ruf, idp)
        _ = await anlegen(ruf, idp, sub=FREMD)
        meine = await ruf.get("/api/kombinationen", headers=als(idp))

    assert meine.json()["gesamt"] == 1
    assert meine.json()["eintraege"][0]["name"] == "Nasser Buchenhang"


async def test_die_liste_blaettert(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    ebenen()
    async with ruf:
        for nummer in range(3):
            _ = await anlegen(ruf, idp, name=f"Regel {nummer}")
        seite = await ruf.get("/api/kombinationen?limit=2&offset=2", headers=als(idp))

    koerper = seite.json()
    assert koerper["gesamt"] == 3
    assert koerper["limit"] == 2
    assert len(koerper["eintraege"]) == 1


async def test_aendern_setzt_nur_die_gesendeten_felder(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(ruf, idp)
        geaendert = await ruf.patch(
            f"/api/kombinationen/{angelegt['id']}",
            json={"regel": "abgestuft"},
            headers=als(idp),
        )

    koerper = geaendert.json()
    assert koerper["regel"] == "abgestuft"
    assert koerper["name"] == angelegt["name"]
    assert koerper["faktoren"] == angelegt["faktoren"]


async def test_neue_faktoren_ersetzen_die_alten(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(ruf, idp)
        geaendert = await ruf.patch(
            f"/api/kombinationen/{angelegt['id']}",
            json={"faktoren": [{"quelle": "temperatur", "bedingung": "unter", "bis": 20}]},
            headers=als(idp),
        )

    assert geaendert.json()["faktoren"] == [
        {"quelle": "temperatur", "bedingung": "unter", "von": None, "bis": 20.0, "aktiv": True},
    ]


async def test_aendern_prueft_die_neuen_quellen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(ruf, idp)
        antwort = await ruf.patch(
            f"/api/kombinationen/{angelegt['id']}",
            json={"faktoren": [{"quelle": "mondphase", "bedingung": "ueber", "von": 1}]},
            headers=als(idp),
        )

    assert antwort.status_code == 422


async def test_eine_kombination_laesst_sich_loeschen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(ruf, idp)
        geloescht = await ruf.delete(f"/api/kombinationen/{angelegt['id']}", headers=als(idp))
        nachher = await ruf.get(f"/api/kombinationen/{angelegt['id']}", headers=als(idp))

    assert geloescht.status_code == 204
    assert nachher.status_code == 404


@pytest.mark.parametrize("verb", ["get", "patch", "delete"])
async def test_eine_fremde_kombination_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    verb: str,
) -> None:
    ebenen()
    async with ruf:
        angelegt = await anlegen(ruf, idp)
        pfad = f"/api/kombinationen/{angelegt['id']}"
        if verb == "patch":
            antwort = await ruf.patch(pfad, json={"name": "fremd"}, headers=als(idp, FREMD))
        else:
            antwort = await ruf.request(verb.upper(), pfad, headers=als(idp, FREMD))

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "not_found"


async def test_eine_unbekannte_kennung_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.get("/api/kombinationen/gibt-es-nicht", headers=als(idp))

    assert antwort.status_code == 404
