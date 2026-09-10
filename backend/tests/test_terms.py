"""Die verwalteten Begriffskataloge.

Geruch, Geschmack und Baumart stehen als Zeilen in der Datenbank, nicht als
Enum im Code. Diese Tests halten fest, dass der Bestand ankommt und dass eine
neue Zeile ohne Deploy sichtbar wird.
"""

import httpx
from fastapi import FastAPI
from sqlalchemy import select

from app.core.db import session_factory
from app.main import build_app
from app.models import Term
from app.modules.terms.schemas import TermKind


def client(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_the_catalog_carries_all_three_kinds(migrated: None) -> None:  # noqa: ARG001
    async with client(build_app()) as call:
        answer = await call.get("/api/begriffe")

    assert answer.status_code == 200
    body = answer.json()
    assert set(body) == {"geruch", "geschmack", "baeume"}
    assert all(body[kind] for kind in body)


async def test_every_term_carries_slug_and_name(migrated: None) -> None:  # noqa: ARG001
    async with client(build_app()) as call:
        body = (await call.get("/api/begriffe")).json()

    for entries in body.values():
        for entry in entries:
            assert set(entry) == {"slug", "name"}
            assert entry["slug"].strip()
            assert entry["name"].strip()


async def test_the_trees_keep_their_order(migrated: None) -> None:  # noqa: ARG001
    async with client(build_app()) as call:
        trees = (await call.get("/api/begriffe")).json()["baeume"]

    # Die Nadelbaeume stehen vorn, weil die Liste nach Verwandtschaft sortiert.
    assert [tree["slug"] for tree in trees][:3] == ["fichte", "kiefer", "tanne"]


async def test_a_new_term_needs_no_deploy(migrated: None) -> None:  # noqa: ARG001
    async with session_factory()() as session:
        session.add(
            Term(kind=TermKind.SMELL, slug="nach-lakritz", name="nach Lakritz", position=99)
        )
        await session.commit()

    async with client(build_app()) as call:
        smells = (await call.get("/api/begriffe")).json()["geruch"]

    assert {"slug": "nach-lakritz", "name": "nach Lakritz"} in smells


async def test_no_kind_holds_a_slug_twice(migrated: None) -> None:  # noqa: ARG001
    async with session_factory()() as session:
        rows = (await session.execute(select(Term.kind, Term.slug))).all()

    assert len(rows) == len(set(rows))
