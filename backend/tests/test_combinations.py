"""Gespeicherte Kombinationen: Faktoren, Quellen, Besitz.

Die Vorrichtung legt drei Ebenen unter PILZE_MAPS ab. Der Testkatalog kennt
dazu die Wertkarte ``boletus_edulis``. Alles andere ist keine Quelle.
"""

from typing import Any

import httpx
import pytest

from app.modules.combinations import sources
from tests.conftest import FakeIdp
from tests.objects import combination_body, maps_folder, write_layers
from tests.test_finds import OTHER, OWN, as_user


def layers(names: list[str] | None = None) -> None:
    """Schreibt layers.json und leert den Zwischenspeicher des Prozesses."""
    sources.layer_names.cache_clear()
    write_layers(maps_folder(), names)


async def create(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    sub: str = OWN,
    **override: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt eine Kombination an und liefert die Antwort."""
    response = await call.post(
        "/api/kombinationen",
        json=combination_body(**override),
        headers=as_user(idp, sub),
    )
    assert response.status_code == 201, response.text
    return response.json()


# ------------------------------------------------------------------ Anlegen und Lesen


async def test_without_a_token_there_are_no_combinations(call: httpx.AsyncClient) -> None:
    async with call:
        response = await call.get("/api/kombinationen")

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_a_combination_comes_back_with_its_factors(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        created = await create(call, idp)
        read_back = await call.get(f"/api/kombinationen/{created['id']}", headers=as_user(idp))

    body = read_back.json()
    assert body["name"] == "Nasser Buchenhang"
    assert body["regel"] == "schnitt"
    assert body["faktoren"] == [
        {"quelle": "regen_4w", "bedingung": "ueber", "von": 80.0, "bis": None, "aktiv": True},
        {"quelle": "temperatur", "bedingung": "zwischen", "von": 8.0, "bis": 16.0, "aktiv": True},
        {"quelle": "hangneigung", "bedingung": "unter", "von": None, "bis": 15.0, "aktiv": False},
    ]
    assert "besitzerSub" not in body


async def test_a_catalog_map_is_a_source_too(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        created = await create(
            call,
            idp,
            factors=[{"quelle": "boletus_edulis", "bedingung": "ueber", "von": 0.1}],
        )

    assert created["faktoren"][0]["quelle"] == "boletus_edulis"


async def test_without_layers_json_only_the_value_maps_remain(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    sources.layer_names.cache_clear()
    async with call:
        mit_karte = await call.post(
            "/api/kombinationen",
            json=combination_body(
                factors=[{"quelle": "boletus_edulis", "bedingung": "ueber", "von": 0.1}],
            ),
            headers=as_user(idp),
        )
        mit_ebene = await call.post(
            "/api/kombinationen",
            json=combination_body(),
            headers=as_user(idp),
        )

    assert mit_karte.status_code == 201
    assert mit_ebene.status_code == 422


async def test_the_rule_has_a_default(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    layers()
    body = combination_body()
    del body["regel"]
    async with call:
        response = await call.post("/api/kombinationen", json=body, headers=as_user(idp))

    assert response.json()["regel"] == "schnitt"


async def test_graded_is_the_second_rule(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    layers()
    async with call:
        created = await create(call, idp, rule="abgestuft")

    assert created["regel"] == "abgestuft"


async def test_there_is_no_third_rule(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    layers()
    async with call:
        response = await call.post(
            "/api/kombinationen",
            json=combination_body(rule="vereinigung"),
            headers=as_user(idp),
        )

    assert response.status_code == 422


# ------------------------------------------------------------------ Faktoren


@pytest.mark.parametrize(
    ("factor", "message"),
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
async def test_a_factor_outside_the_rules(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    factor: dict[str, Any],
    message: str,
) -> None:
    layers()
    async with call:
        response = await call.post(
            "/api/kombinationen",
            json=combination_body(factors=[factor]),
            headers=as_user(idp),
        )

    assert response.status_code == 422
    assert message in response.text


async def test_an_unknown_source_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        response = await call.post(
            "/api/kombinationen",
            json=combination_body(
                factors=[
                    {"quelle": "mondphase", "bedingung": "ueber", "von": 1},
                    {"quelle": "regen_4w", "bedingung": "ueber", "von": 80},
                ],
            ),
            headers=as_user(idp),
        )

    assert response.status_code == 422
    assert response.json()["detail"] == "Diese Quellen gibt es nicht: mondphase."


async def test_without_a_factor_there_is_nothing_to_show(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        response = await call.post(
            "/api/kombinationen",
            json=combination_body(factors=[]),
            headers=as_user(idp),
        )

    assert response.status_code == 422


async def test_at_most_eight_factors(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    layers([f"ebene_{nummer}" for nummer in range(9)])
    factors = [
        {"quelle": f"ebene_{nummer}", "bedingung": "ueber", "von": 1.0} for nummer in range(9)
    ]
    async with call:
        too_many = await call.post(
            "/api/kombinationen",
            json=combination_body(factors=factors),
            headers=as_user(idp),
        )
        just_enough = await call.post(
            "/api/kombinationen",
            json=combination_body(factors=factors[:8]),
            headers=as_user(idp),
        )

    assert too_many.status_code == 422
    assert just_enough.status_code == 201


# ------------------------------------------------------------------ Liste, Aendern, Loeschen


async def test_the_listing_shows_only_own_combinations(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        _ = await create(call, idp)
        _ = await create(call, idp, sub=OTHER)
        mine = await call.get("/api/kombinationen", headers=as_user(idp))

    assert mine.json()["gesamt"] == 1
    assert mine.json()["eintraege"][0]["name"] == "Nasser Buchenhang"


async def test_the_listing_pages(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    layers()
    async with call:
        for nummer in range(3):
            _ = await create(call, idp, name=f"Regel {nummer}")
        page = await call.get("/api/kombinationen?limit=2&offset=2", headers=as_user(idp))

    body = page.json()
    assert body["gesamt"] == 3
    assert body["limit"] == 2
    assert len(body["eintraege"]) == 1


async def test_patch_sets_only_the_sent_fields(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        created = await create(call, idp)
        patched = await call.patch(
            f"/api/kombinationen/{created['id']}",
            json={"regel": "abgestuft"},
            headers=as_user(idp),
        )

    body = patched.json()
    assert body["regel"] == "abgestuft"
    assert body["name"] == created["name"]
    assert body["faktoren"] == created["faktoren"]


async def test_new_factors_replace_the_old_ones(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        created = await create(call, idp)
        patched = await call.patch(
            f"/api/kombinationen/{created['id']}",
            json={"faktoren": [{"quelle": "temperatur", "bedingung": "unter", "bis": 20}]},
            headers=as_user(idp),
        )

    assert patched.json()["faktoren"] == [
        {"quelle": "temperatur", "bedingung": "unter", "von": None, "bis": 20.0, "aktiv": True},
    ]


async def test_patch_checks_the_new_sources(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        created = await create(call, idp)
        response = await call.patch(
            f"/api/kombinationen/{created['id']}",
            json={"faktoren": [{"quelle": "mondphase", "bedingung": "ueber", "von": 1}]},
            headers=as_user(idp),
        )

    assert response.status_code == 422


async def test_a_combination_can_be_deleted(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    layers()
    async with call:
        created = await create(call, idp)
        deleted = await call.delete(f"/api/kombinationen/{created['id']}", headers=as_user(idp))
        afterwards = await call.get(f"/api/kombinationen/{created['id']}", headers=as_user(idp))

    assert deleted.status_code == 204
    assert afterwards.status_code == 404


@pytest.mark.parametrize("verb", ["get", "patch", "delete"])
async def test_another_persons_combination_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    verb: str,
) -> None:
    layers()
    async with call:
        created = await create(call, idp)
        path = f"/api/kombinationen/{created['id']}"
        if verb == "patch":
            response = await call.patch(path, json={"name": "fremd"}, headers=as_user(idp, OTHER))
        else:
            response = await call.request(verb.upper(), path, headers=as_user(idp, OTHER))

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_an_unknown_id_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.get("/api/kombinationen/gibt-es-nicht", headers=as_user(idp))

    assert response.status_code == 404
