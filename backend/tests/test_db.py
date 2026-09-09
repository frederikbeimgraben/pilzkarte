"""Engine, Sitzung und die Migration auf einer leeren Datei."""

from pathlib import Path

from sqlalchemy import select, text

from app.core.db import DATEI_PRAEFIX, motor, ordner_anlegen, sitzung
from app.core.settings import einstellungen
from app.models import Base, Nutzer


async def test_sitzung_beantwortet_eine_abfrage() -> None:
    async for offen in sitzung():
        ergebnis = await offen.execute(text("SELECT 1"))
        assert ergebnis.scalar_one() == 1


async def test_schema_traegt_die_tabelle_nutzer() -> None:
    async with motor().begin() as verbindung:
        await verbindung.run_sync(Base.metadata.create_all)

    async for offen in sitzung():
        offen.add(Nutzer(sub="nutzer-1"))
        await offen.commit()
        gefunden = await offen.execute(select(Nutzer.sub))
        assert gefunden.scalar_one() == "nutzer-1"


def test_ordner_der_datei_entsteht(tmp_path: Path) -> None:
    ziel = tmp_path / "tief" / "pilze.sqlite"

    ordner_anlegen(f"{DATEI_PRAEFIX}{ziel}")

    assert ziel.parent.is_dir()


def test_fremde_url_bleibt_unberuehrt() -> None:
    ordner_anlegen("postgresql+asyncpg://server/pilze")


def test_die_engine_folgt_der_umgebung() -> None:
    assert str(motor().url).startswith("sqlite+aiosqlite:")
    assert einstellungen().db.endswith("pilze.sqlite")
