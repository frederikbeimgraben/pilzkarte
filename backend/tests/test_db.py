"""Engine, Sitzung und die Migration auf einer leeren Datei."""

from pathlib import Path

from sqlalchemy import select, text

from app.core.db import FILE_PREFIX, create_folder, db_session, engine
from app.core.settings import get_settings
from app.models import Base, Person


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
