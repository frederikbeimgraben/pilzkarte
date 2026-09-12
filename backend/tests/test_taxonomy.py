"""Die Einordnung: eine Tabelle, verkettet auf sich selbst.

Der Bestand kommt aus ``daten/taxonomie.json``. Diese Tests halten fest, dass
die Kette geschlossen ist, dass jede Art eine Stufe findet, dass eine Seite
beides zeigt -- nach oben und nach unten -- und dass kein deutscher Name im
Bestand steht, den die Zaehlung nicht traegt.
"""

import json

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select

from app.core.db import session_factory
from app.main import build_app
from app.models import Taxon
from app.modules.species.catalog import DATA, read_profiles
from app.modules.species.dependencies import current_catalog
from app.modules.taxonomy.naming import genus_of, genus_slug_of, taxon_slug
from app.modules.taxonomy.seed import SEED_FILE, seed_taxa
from app.modules.taxonomy.service import sync_taxa
from app.shared.schemas import TaxonRank
from tests.objects import catalog_for_tests

RANK_ORDER = list(TaxonRank)


@pytest.fixture
def taxonomy_app(migrated: None) -> FastAPI:  # noqa: ARG001
    """Die App mit gefuellter Einordnung und dem Katalog der Tests."""
    built = build_app()
    built.dependency_overrides[current_catalog] = catalog_for_tests
    return built


@pytest.fixture
def call(taxonomy_app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=taxonomy_app), base_url="http://test"
    )


def test_the_slug_of_a_species_names_its_genus() -> None:
    assert genus_of("Boletus edulis") == "Boletus"
    assert taxon_slug("Boletaceae") == "boletaceae"
    assert genus_slug_of("Suillus cavipes var. aereus") == "suillus"


def test_every_step_of_the_seed_hangs_under_a_wider_one() -> None:
    rows = {seed.slug: seed for seed in seed_taxa()}

    for seed in rows.values():
        if seed.parent is None:
            assert seed.rank is TaxonRank.CLASS
            continue
        above = rows[seed.parent]
        assert RANK_ORDER.index(above.rank) < RANK_ORDER.index(seed.rank)


def test_the_seed_carries_all_four_ranks() -> None:
    ranks = {seed.rank for seed in seed_taxa()}

    assert ranks == set(TaxonRank)


def test_no_german_name_stands_without_a_count() -> None:
    """Ein Name, den die Zaehlung nicht traegt, ist der lateinische."""
    raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))

    for entry in raw["taxa"]:
        if "belege" in entry:
            assert entry["name"] == next(iter(entry["belege"]))
        else:
            assert entry["name"] == entry["lateinisch"]


def test_every_species_of_the_catalogue_finds_its_step() -> None:
    known = {seed.slug for seed in seed_taxa()}
    profiles = read_profiles(DATA / "arten")

    missing = {
        slug for slug, profile in profiles.items() if genus_slug_of(profile.scientific) not in known
    }

    assert missing == set()


async def test_the_migration_fills_the_table(migrated: None) -> None:  # noqa: ARG001
    async with session_factory()() as session:
        rows = (await session.execute(select(Taxon))).scalars().all()

    assert len(rows) == len(seed_taxa())
    assert {row.slug for row in rows} == {seed.slug for seed in seed_taxa()}


async def test_a_new_step_needs_no_migration(migrated: None) -> None:  # noqa: ARG001
    """Der Abgleich beim Start holt nach, was die Vorgabe kennt."""
    async with session_factory()() as session:
        boletus = (await session.execute(select(Taxon).where(Taxon.slug == "boletus"))).scalar_one()
        await session.delete(boletus)
        await session.commit()

    async with session_factory()() as session:
        await sync_taxa(session)
        again = (await session.execute(select(Taxon).where(Taxon.slug == "boletus"))).scalar_one()

        assert again.rank is TaxonRank.GENUS
        assert again.parent_id is not None


async def test_a_genus_page_shows_its_way_up_and_its_species(call: httpx.AsyncClient) -> None:
    async with call:
        answer = await call.get("/api/taxonomie/gattung/boletus")

    assert answer.status_code == 200
    body = answer.json()
    assert body["rang"] == "gattung"
    assert body["lateinisch"] == "Boletus"
    assert [step["slug"] for step in body["pfad"]] == ["agaricomycetes", "boletales", "boletaceae"]
    assert [step["rang"] for step in body["pfad"]] == ["klasse", "ordnung", "familie"]
    assert [art["slug"] for art in body["arten"]] == ["steinpilz"]
    assert body["artenZahl"] == 1
    assert body["kinder"] == []


async def test_the_siblings_of_a_genus_stand_under_the_same_family(
    call: httpx.AsyncClient,
) -> None:
    async with call:
        body = (await call.get("/api/taxonomie/gattung/boletus")).json()

    siblings = {step["slug"] for step in body["geschwister"]}
    assert "imleria" in siblings
    assert "boletus" not in siblings
    assert all(step["rang"] == "gattung" for step in body["geschwister"])


async def test_a_family_page_counts_the_species_of_its_genera(call: httpx.AsyncClient) -> None:
    async with call:
        body = (await call.get("/api/taxonomie/familie/boletaceae")).json()

    children = {child["slug"]: child for child in body["kinder"]}
    assert children["boletus"]["artenZahl"] == 1
    assert children["imleria"]["artenZahl"] == 0
    # Die Arten haengen an der Gattung, nicht an der Familie.
    assert body["arten"] == []
    assert body["artenZahl"] == 1


async def test_the_order_carries_the_german_name_the_count_gave(call: httpx.AsyncClient) -> None:
    async with call:
        body = (await call.get("/api/taxonomie/ordnung/boletales")).json()

    assert body["name"] == "Röhrlinge"
    assert body["lateinisch"] == "Boletales"


async def test_a_step_without_a_count_keeps_its_latin_name(call: httpx.AsyncClient) -> None:
    async with call:
        body = (await call.get("/api/taxonomie/klasse/agaricomycetes")).json()

    assert body["name"] == body["lateinisch"] == "Agaricomycetes"
    assert body["pfad"] == []
    # Zwei Klassen stehen an der Wurzel, jede ist der Nachbar der anderen.
    assert [step["slug"] for step in body["geschwister"]] == ["pezizomycetes"]


async def test_the_rank_in_the_address_has_to_match(call: httpx.AsyncClient) -> None:
    async with call:
        wrong = await call.get("/api/taxonomie/familie/boletus")
        unknown = await call.get("/api/taxonomie/gattung/gibtesnicht")
        no_such_rank = await call.get("/api/taxonomie/reich/fungi")

    assert wrong.status_code == 404
    assert wrong.headers["content-type"].startswith("application/problem+json")
    assert unknown.status_code == 404
    assert no_such_rank.status_code == 422


async def test_the_profile_of_a_species_carries_its_way_to_the_class(
    call: httpx.AsyncClient,
) -> None:
    async with call:
        body = (await call.get("/api/arten/steinpilz")).json()

    assert [step["slug"] for step in body["taxonomie"]] == [
        "agaricomycetes",
        "boletales",
        "boletaceae",
        "boletus",
    ]
    assert body["taxonomie"][-1]["rang"] == "gattung"
