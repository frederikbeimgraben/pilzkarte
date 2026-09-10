"""Marker: anlegen, lesen, aendern, loeschen, und immer nur die eigenen."""

from typing import Any

import httpx
import pytest

from tests.conftest import FakeIdp
from tests.objects import marker_body
from tests.test_finds import OTHER, OWN, as_user


async def create_marker(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    sub: str = OWN,
    **override: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt einen Marker an und liefert die Antwort."""
    response = await call.post(
        "/api/marker",
        json=marker_body(**override),
        headers=as_user(idp, sub),
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_without_a_token_there_are_no_markers(call: httpx.AsyncClient) -> None:
    async with call:
        response = await call.get("/api/marker")

    assert response.status_code == 401


async def test_a_marker_carries_colour_and_note(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_marker(call, idp)
        read_back = await call.get(f"/api/marker/{created['id']}", headers=as_user(idp))

    body = read_back.json()
    assert body["name"] == "Alter Fichtenhang"
    assert body["farbe"] == "blau"
    assert body["sichtbarkeit"] == "privat"


async def test_a_colour_outside_the_six_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.post(
            "/api/marker",
            json=marker_body(color="magenta"),
            headers=as_user(idp),
        )

    assert response.status_code == 422


async def test_a_marker_outside_germany_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.post(
            "/api/marker",
            json=marker_body(lat=41.9, lon=12.5),
            headers=as_user(idp),
        )

    assert response.status_code == 422


async def test_a_marker_without_a_name_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.post("/api/marker", json=marker_body(name=""), headers=as_user(idp))

    assert response.status_code == 422


async def test_the_listing_shows_only_own_markers(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_marker(call, idp)
        _ = await create_marker(call, idp, sub=OTHER)
        mine = await call.get("/api/marker", headers=as_user(idp))

    assert mine.json()["gesamt"] == 1


async def test_the_marker_listing_pages(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        for nummer in range(3):
            _ = await create_marker(call, idp, name=f"Stelle {nummer}")
        page = await call.get("/api/marker?limit=1&offset=1", headers=as_user(idp))

    body = page.json()
    assert body["gesamt"] == 3
    assert len(body["eintraege"]) == 1


async def test_a_marker_can_be_patched(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_marker(call, idp)
        patched = await call.patch(
            f"/api/marker/{created['id']}",
            json={"farbe": "rot", "sichtbarkeit": "geteilt"},
            headers=as_user(idp),
        )

    body = patched.json()
    assert body["farbe"] == "rot"
    assert body["sichtbarkeit"] == "geteilt"
    assert body["name"] == created["name"]


async def test_a_marker_can_be_deleted(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_marker(call, idp)
        deleted = await call.delete(f"/api/marker/{created['id']}", headers=as_user(idp))
        afterwards = await call.get(f"/api/marker/{created['id']}", headers=as_user(idp))

    assert deleted.status_code == 204
    assert afterwards.status_code == 404


@pytest.mark.parametrize("verb", ["get", "patch", "delete"])
async def test_another_persons_marker_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    verb: str,
) -> None:
    async with call:
        created = await create_marker(call, idp)
        path = f"/api/marker/{created['id']}"
        if verb == "patch":
            response = await call.patch(path, json={"farbe": "rot"}, headers=as_user(idp, OTHER))
        else:
            response = await call.request(verb.upper(), path, headers=as_user(idp, OTHER))

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
