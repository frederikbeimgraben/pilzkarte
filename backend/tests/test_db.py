"""Engine, Sitzung und die Migration auf einer leeren Datei."""

from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.core.db import FILE_PREFIX, create_folder, db_session, engine
from app.core.settings import get_settings
from app.models import Base, Find, Person, Role, UiText, UserRole, Visibility


async def test_a_session_answers_a_query() -> None:
    async for open_ring in db_session():
        ergebnis = await open_ring.execute(text("SELECT 1"))
        assert ergebnis.scalar_one() == 1


async def test_the_schema_carries_the_user_table() -> None:
    async with engine().begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async for open_ring in db_session():
        open_ring.add(Person(sub="nutzer-1"))
        await open_ring.commit()
        found = await open_ring.execute(select(Person.sub))
        assert found.scalar_one() == "nutzer-1"


def test_the_folder_of_the_file_is_created(tmp_path: Path) -> None:
    target = tmp_path / "tief" / "pilze.sqlite"

    create_folder(f"{FILE_PREFIX}{target}")

    assert target.parent.is_dir()


def test_a_foreign_url_stays_untouched() -> None:
    create_folder("postgresql+asyncpg://server/pilze")


def test_the_engine_follows_the_environment() -> None:
    assert str(engine().url).startswith("sqlite+aiosqlite:")
    assert get_settings().db.endswith("pilze.sqlite")


async def test_the_connection_enforces_foreign_keys() -> None:
    """Ohne diese Pragma stuende die Zugehoerigkeit im Schema und hielte nichts."""
    async for open_ring in db_session():
        found = await open_ring.execute(text("PRAGMA foreign_keys"))
        assert found.scalar_one() == 1


async def test_an_object_without_an_account_is_refused() -> None:
    """Ein Fund zeigt auf ein Konto. Zeigt er ins Leere, weist die Datenbank ihn ab."""
    async with engine().begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async for open_ring in db_session():
        open_ring.add(
            Find(
                owner_sub="niemand",
                species_slug="steinpilz",
                lat=48.5,
                lon=9.2,
                found_on=date(2026, 9, 1),
                visibility=Visibility.PRIVATE,
            )
        )
        with pytest.raises(IntegrityError):
            await open_ring.commit()
        await open_ring.rollback()


async def a_person(sub: str = "nutzer-1") -> None:
    """Legt Schema und ein Konto an, auf das ein Objekt zeigen kann."""
    async with engine().begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async for open_ring in db_session():
        open_ring.add(Person(sub=sub))
        await open_ring.commit()


def a_find(sub: str) -> Find:
    return Find(
        owner_sub=sub,
        species_slug="steinpilz",
        lat=48.5,
        lon=9.2,
        found_on=date(2026, 9, 1),
        visibility=Visibility.PRIVATE,
    )


async def test_an_account_with_a_find_cannot_be_deleted() -> None:
    """``RESTRICT``: ein geloeschtes Konto darf seine Funde nicht mitreissen.

    Wer das Loeschen von Konten baut, stoesst hier an und muss je Tabelle
    entscheiden, was mit dem Bestand geschieht. Genau das ist der Zweck.
    """
    await a_person()

    async for open_ring in db_session():
        open_ring.add(a_find("nutzer-1"))
        await open_ring.commit()
        person = await open_ring.get(Person, "nutzer-1")
        assert person is not None
        await open_ring.delete(person)
        with pytest.raises(IntegrityError):
            await open_ring.commit()
        await open_ring.rollback()


async def test_a_deleted_account_takes_its_roles_with_it() -> None:
    """``CASCADE``: eine Rolle an einem Konto, das es nicht gibt, sagt nichts."""
    await a_person()

    async for open_ring in db_session():
        open_ring.add(Role(id="rolle-1", slug="sammler", name="Sammler"))
        await open_ring.commit()
        open_ring.add(UserRole(user_sub="nutzer-1", role_id="rolle-1"))
        await open_ring.commit()
        person = await open_ring.get(Person, "nutzer-1")
        assert person is not None
        await open_ring.delete(person)
        await open_ring.commit()
        left = await open_ring.execute(select(UserRole.user_sub))
        assert left.all() == []


async def test_a_deleted_account_leaves_the_text_it_wrote() -> None:
    """``SET NULL``: dem Text bleibt sein Wortlaut, nur der Name faellt weg."""
    await a_person()

    async for open_ring in db_session():
        open_ring.add(UiText(key="map.title", locale="de", value="Karte", updated_by="nutzer-1"))
        await open_ring.commit()
        person = await open_ring.get(Person, "nutzer-1")
        assert person is not None
        await open_ring.delete(person)
        await open_ring.commit()
        row = await open_ring.get(UiText, ("map.title", "de"))
        assert row is not None
        assert (row.value, row.updated_by) == ("Karte", None)
