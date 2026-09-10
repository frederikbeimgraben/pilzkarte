"""Der Weg von der App in die Kette.

Die Liste traegt den genauen Fundort. Sie darf darum nur beim Aufruf vom
Rechner selbst herauskommen, nicht ueber den Vhost.
"""

import httpx
import pytest
from fastapi import FastAPI
from starlette.requests import Request

from app.core.errors import NichtGefunden
from app.modules.arten.router import aktueller_katalog
from app.modules.intern.router import nur_vom_rechner
from tests.conftest import FalscherIdp
from tests.objekte import katalog_der_tests
from tests.test_funde import EIGEN, FREMD, als, fund_anlegen

PFAD = "/api/intern/training-funde"


def klient(app: FastAPI, host: str = "127.0.0.1") -> httpx.AsyncClient:
    """Ein Klient, der von einer bestimmten Adresse aus anfragt."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, client=(host, 4711)),
        base_url="http://test",
    )


def anfrage(host: str | None, kopfzeilen: list[tuple[bytes, bytes]]) -> Request:
    """Eine nackte Anfrage, so wie ASGI sie durchreicht."""
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": PFAD,
            "headers": kopfzeilen,
            "client": None if host is None else (host, 4711),
        }
    )


async def test_die_kette_holt_die_freigegebenen_funde(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        freigegeben = await fund_anlegen(ruf, idp, fuerTraining=True, artSlug="pfifferling")
        _ = await fund_anlegen(ruf, idp)
        _ = await fund_anlegen(ruf, idp, sub=FREMD, fuerTraining=True, artSlug="parasol")
        antwort = await ruf.get(PFAD)

    liste = antwort.json()
    assert antwort.status_code == 200
    # Beide freigegebenen Funde, auch der eines anderen Kontos. Die Kette
    # rechnet fuer alle.
    assert len(liste) == 2
    eintrag = next(zeile for zeile in liste if zeile["id"] == freigegeben["id"])
    assert eintrag["artSlug"] == "pfifferling"
    assert eintrag["lateinisch"] == "Cantharellus cibarius"
    # Genau, nicht gerundet: das ist der Sinn der Freigabe.
    assert (eintrag["lat"], eintrag["lon"]) == (freigegeben["lat"], freigegeben["lon"])
    assert eintrag["datum"] == freigegeben["datum"]
    assert eintrag["anzahl"] == freigegeben["anzahl"]


async def test_ohne_freigabe_bleibt_die_liste_leer(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp)
        antwort = await ruf.get(PFAD)

    assert antwort.json() == []


async def test_eine_art_ausserhalb_des_katalogs_faellt_heraus(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    objekt_app: FastAPI,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, fuerTraining=True)
        # Der Katalog verliert die Art, der Fund bleibt in der Datenbank.
        gekuerzt = katalog_der_tests()
        del gekuerzt.profile["steinpilz"]
        objekt_app.dependency_overrides[aktueller_katalog] = lambda: gekuerzt
        antwort = await ruf.get(PFAD)

    assert antwort.json() == []


async def test_ueber_den_vhost_gibt_es_den_pfad_nicht(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, fuerTraining=True)
        # Caddy setzt diese Kopfzeile. Ein gefaelschter Wert hilft nicht: schon
        # ihr Vorhandensein schliesst den Weg aus.
        antwort = await ruf.get(PFAD, headers={"X-Forwarded-For": "127.0.0.1"})

    assert antwort.status_code == 404
    assert antwort.headers["content-type"].startswith("application/problem+json")


async def test_von_einer_fremden_adresse_gibt_es_den_pfad_nicht(
    objekt_app: FastAPI,
    idp: FalscherIdp,
) -> None:
    async with klient(objekt_app) as lokal:
        _ = await fund_anlegen(lokal, idp, fuerTraining=True)
    async with klient(objekt_app, "203.0.113.5") as fremd:
        antwort = await fremd.get(PFAD)

    assert antwort.status_code == 404


async def test_ein_token_hilft_von_aussen_nicht(
    objekt_app: FastAPI,
    idp: FalscherIdp,
) -> None:
    async with klient(objekt_app, "203.0.113.5") as fremd:
        antwort = await fremd.get(PFAD, headers=als(idp, EIGEN))

    assert antwort.status_code == 404


@pytest.mark.parametrize(
    ("host", "kopfzeilen"),
    [
        pytest.param(None, [], id="ohne-adresse"),
        pytest.param("10.0.0.7", [], id="fremde-adresse"),
        pytest.param("127.0.0.1", [(b"forwarded", b"for=127.0.0.1")], id="forwarded"),
        pytest.param("127.0.0.1", [(b"x-forwarded-host", b"pilze.test")], id="x-forwarded-host"),
    ],
)
def test_nur_vom_rechner_weist_ab(host: str | None, kopfzeilen: list[tuple[bytes, bytes]]) -> None:
    with pytest.raises(NichtGefunden):
        nur_vom_rechner(anfrage(host, kopfzeilen))


@pytest.mark.parametrize("host", ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
def test_der_rechner_selbst_kommt_durch(host: str) -> None:
    nur_vom_rechner(anfrage(host, []))
