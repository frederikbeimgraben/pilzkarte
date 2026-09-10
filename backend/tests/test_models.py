"""Die Tabellen: was der Vertrag von einer Spalte verlangt."""

from datetime import UTC, datetime

from sqlalchemy.dialects import sqlite

from app.models import UtcTime

DIALECT = sqlite.dialect()


def test_a_timestamp_goes_into_the_column_as_utc() -> None:
    typ = UtcTime()
    berlin = datetime.fromisoformat("2026-09-10T14:00:00+02:00")

    abgelegt = typ.process_bind_param(berlin, DIALECT)

    assert abgelegt == datetime(2026, 9, 10, 12, 0, tzinfo=UTC)


def test_a_timestamp_comes_back_with_a_timezone() -> None:
    typ = UtcTime()

    # So kommt der Wert aus SQLite: ohne Zeitzone. Genau das repariert die Spalte.
    read_back = typ.process_result_value(datetime(2026, 9, 10, 12, 0), DIALECT)  # noqa: DTZ001

    assert read_back == datetime(2026, 9, 10, 12, 0, tzinfo=UTC)


def test_an_empty_column_stays_empty() -> None:
    # Die Spalte gibt es auch fuer Felder, die leer sein duerfen. Der Vertrag
    # von TypeDecorator verlangt darum beide Richtungen fuer None.
    typ = UtcTime()

    assert typ.process_bind_param(None, DIALECT) is None
    assert typ.process_result_value(None, DIALECT) is None
