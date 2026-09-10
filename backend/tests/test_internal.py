"""Der Weg von der App in die Kette.

Die Liste traegt den genauen Fundort. Sie darf darum nur beim Aufruf vom
Rechner selbst herauskommen, nicht ueber den Vhost.
"""

import httpx
import pytest
from fastapi import FastAPI
from starlette.requests import Request

from app.core.errors import NotFound
from app.modules.internal.router import only_from_host
from app.modules.species.router import current_catalog
from tests.conftest import FakeIdp
from tests.objects import catalog_for_tests
from tests.test_finds import OTHER, OWN, as_user, create_find

PATH = "/api/intern/training-funde"


def client(app: FastAPI, host: str = "127.0.0.1") -> httpx.AsyncClient:
    """Ein Klient, der von einer bestimmten Adresse aus anfragt."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, client=(host, 4711)),
        base_url="http://test",
    )


def request_for(host: str | None, headers: list[tuple[bytes, bytes]]) -> Request:
    """Eine nackte Anfrage, so wie ASGI sie durchreicht."""
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": PATH,
            "headers": headers,
            "client": None if host is None else (host, 4711),
        }
    )


async def test_the_chain_fetches_the_released_finds(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        released = await create_find(call, idp, fuerTraining=True, artSlug="pfifferling")
        _ = await create_find(call, idp)
        _ = await create_find(call, idp, sub=OTHER, fuerTraining=True, artSlug="parasol")
        response = await call.get(PATH)

    listing = response.json()
    assert response.status_code == 200
    # Beide freigegebenen Funde, auch der eines anderen Kontos. Die Kette
    # rechnet fuer alle.
    assert len(listing) == 2
    entry = next(line for line in listing if line["id"] == released["id"])
    assert entry["artSlug"] == "pfifferling"
    assert entry["lateinisch"] == "Cantharellus cibarius"
    # Genau, nicht gerundet: das ist der Sinn der Freigabe.
    assert (entry["lat"], entry["lon"]) == (released["lat"], released["lon"])
    assert entry["datum"] == released["datum"]
    assert entry["anzahl"] == released["anzahl"]


async def test_without_a_release_the_list_stays_empty(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp)
        response = await call.get(PATH)

    assert response.json() == []


async def test_a_species_outside_the_catalog_drops_out(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    object_app: FastAPI,
) -> None:
    async with call:
        _ = await create_find(call, idp, fuerTraining=True)
        # Der Katalog verliert die Art, der Fund bleibt in der Datenbank.
        shortened = catalog_for_tests()
        del shortened.profiles["steinpilz"]
        object_app.dependency_overrides[current_catalog] = lambda: shortened
        response = await call.get(PATH)

    assert response.json() == []


async def test_over_the_vhost_the_path_does_not_exist(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, fuerTraining=True)
        # Caddy setzt diese Kopfzeile. Ein gefaelschter Wert hilft nicht: schon
        # ihr Vorhandensein schliesst den Weg aus.
        response = await call.get(PATH, headers={"X-Forwarded-For": "127.0.0.1"})

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_from_a_foreign_address_the_path_does_not_exist(
    object_app: FastAPI,
    idp: FakeIdp,
) -> None:
    async with client(object_app) as local:
        _ = await create_find(local, idp, fuerTraining=True)
    async with client(object_app, "203.0.113.5") as other:
        response = await other.get(PATH)

    assert response.status_code == 404


async def test_a_token_does_not_help_from_outside(
    object_app: FastAPI,
    idp: FakeIdp,
) -> None:
    async with client(object_app, "203.0.113.5") as other:
        response = await other.get(PATH, headers=as_user(idp, OWN))

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("host", "headers"),
    [
        pytest.param(None, [], id="ohne-adresse"),
        pytest.param("10.0.0.7", [], id="fremde-adresse"),
        pytest.param("127.0.0.1", [(b"forwarded", b"for=127.0.0.1")], id="forwarded"),
        pytest.param("127.0.0.1", [(b"x-forwarded-host", b"pilze.test")], id="x-forwarded-host"),
    ],
)
def test_only_from_host_rejects(host: str | None, headers: list[tuple[bytes, bytes]]) -> None:
    with pytest.raises(NotFound):
        only_from_host(request_for(host, headers))


@pytest.mark.parametrize("host", ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
def test_the_host_itself_gets_through(host: str) -> None:
    only_from_host(request_for(host, []))
