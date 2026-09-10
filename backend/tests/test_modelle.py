"""Die Tabellen: was der Vertrag von einer Spalte verlangt."""

from datetime import UTC, datetime

from sqlalchemy.dialects import sqlite

from app.models import UtcZeit

DIALEKT = sqlite.dialect()


def test_ein_zeitpunkt_geht_in_utc_in_die_spalte() -> None:
    typ = UtcZeit()
    berlin = datetime.fromisoformat("2026-09-10T14:00:00+02:00")

    abgelegt = typ.process_bind_param(berlin, DIALEKT)

    assert abgelegt == datetime(2026, 9, 10, 12, 0, tzinfo=UTC)


def test_ein_zeitpunkt_kommt_mit_zeitzone_zurueck() -> None:
    typ = UtcZeit()

    # So kommt der Wert aus SQLite: ohne Zeitzone. Genau das repariert die Spalte.
    gelesen = typ.process_result_value(datetime(2026, 9, 10, 12, 0), DIALEKT)  # noqa: DTZ001

    assert gelesen == datetime(2026, 9, 10, 12, 0, tzinfo=UTC)


def test_eine_leere_spalte_bleibt_leer() -> None:
    # Die Spalte gibt es auch fuer Felder, die leer sein duerfen. Der Vertrag
    # von TypeDecorator verlangt darum beide Richtungen fuer None.
    typ = UtcZeit()

    assert typ.process_bind_param(None, DIALEKT) is None
    assert typ.process_result_value(None, DIALEKT) is None
