"""Der Vertrag zum Frontend: camelCase, keine fremden Felder, Zeit mit Zone."""

from datetime import UTC, datetime

import pytest
from pydantic import BaseModel, ValidationError

from app.shared.schemas import BaseSchema, Timestamp, Week, to_camel


class Example(BaseSchema):
    """Ein Modell mit zwei Woertern im Feldnamen."""

    found_at: Timestamp
    count: int


def test_field_names_become_camel_case() -> None:
    assert to_camel("found_at") == "foundAt"
    assert to_camel("origin") == "origin"


def test_json_carries_camel_case() -> None:
    model = Example(found_at=datetime(2026, 9, 7, 8, 0, tzinfo=UTC), count=3)

    assert model.model_dump(by_alias=True)["foundAt"]


def test_alias_and_field_name_both_go_in() -> None:
    from_alias = Example.model_validate({"foundAt": "2026-09-07T08:00:00+02:00", "count": 1})
    from_name = Example.model_validate({"found_at": "2026-09-07T08:00:00+02:00", "count": 1})

    assert from_alias == from_name


def test_an_unknown_field_is_an_error() -> None:
    with pytest.raises(ValidationError):
        Example.model_validate(
            {"foundAt": "2026-09-07T08:00:00+02:00", "count": 1, "extra": 1},
        )


def test_a_time_without_a_zone_is_an_error() -> None:
    with pytest.raises(ValidationError):
        Example.model_validate({"foundAt": "2026-09-07T08:00:00", "count": 1})


def test_week_takes_a_real_calendar_week() -> None:
    week = Week.model_validate({"jahr": 2026, "woche": 40})

    assert (week.year, week.week) == (2026, 40)


@pytest.mark.parametrize(("year", "week"), [(2025, 53), (2026, 0), (2026, 54)])
def test_week_rejects_impossible_weeks(year: int, week: int) -> None:
    # 2025 hat 52 Wochen, 2026 hat 53. Die Regel steckt in fromisocalendar.
    with pytest.raises(ValidationError):
        Week.model_validate({"jahr": year, "woche": week})


def test_the_long_week_exists_in_the_right_year() -> None:
    assert Week.model_validate({"jahr": 2026, "woche": 53}).week == 53


def test_base_schema_stays_a_pydantic_model() -> None:
    assert issubclass(BaseSchema, BaseModel)
