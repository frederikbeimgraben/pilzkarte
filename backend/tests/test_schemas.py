"""Der Vertrag zum Frontend: camelCase, keine fremden Felder, Zeit mit Zone."""

from datetime import UTC, datetime

import pytest
from pydantic import BaseModel, ValidationError

from app.shared.schemas import BasisModell, Woche, Zeitpunkt, zu_camel


class Beispiel(BasisModell):
    """Ein Modell mit zwei Woertern im Feldnamen."""

    gefunden_am: Zeitpunkt
    anzahl: int


def test_feldnamen_werden_camel_case() -> None:
    assert zu_camel("gefunden_am") == "gefundenAm"
    assert zu_camel("origin") == "origin"


def test_json_traegt_camel_case() -> None:
    modell = Beispiel(gefunden_am=datetime(2026, 9, 7, 8, 0, tzinfo=UTC), anzahl=3)

    assert modell.model_dump(by_alias=True)["gefundenAm"]


def test_alias_und_feldname_gehen_beide_hinein() -> None:
    aus_alias = Beispiel.model_validate({"gefundenAm": "2026-09-07T08:00:00+02:00", "anzahl": 1})
    aus_name = Beispiel.model_validate({"gefunden_am": "2026-09-07T08:00:00+02:00", "anzahl": 1})

    assert aus_alias == aus_name


def test_fremdes_feld_ist_ein_fehler() -> None:
    with pytest.raises(ValidationError):
        Beispiel.model_validate(
            {"gefundenAm": "2026-09-07T08:00:00+02:00", "anzahl": 1, "extra": 1},
        )


def test_zeit_ohne_zone_ist_ein_fehler() -> None:
    with pytest.raises(ValidationError):
        Beispiel.model_validate({"gefundenAm": "2026-09-07T08:00:00", "anzahl": 1})


def test_woche_nimmt_eine_echte_kalenderwoche() -> None:
    woche = Woche.model_validate({"jahr": 2026, "woche": 40})

    assert (woche.jahr, woche.woche) == (2026, 40)


@pytest.mark.parametrize(("jahr", "woche"), [(2025, 53), (2026, 0), (2026, 54)])
def test_woche_weist_unmoegliche_wochen_ab(jahr: int, woche: int) -> None:
    # 2025 hat 52 Wochen, 2026 hat 53. Die Regel steckt in fromisocalendar.
    with pytest.raises(ValidationError):
        Woche.model_validate({"jahr": jahr, "woche": woche})


def test_lange_woche_gibt_es_im_richtigen_jahr() -> None:
    assert Woche.model_validate({"jahr": 2026, "woche": 53}).woche == 53


def test_basis_modell_bleibt_ein_pydantic_modell() -> None:
    assert issubclass(BasisModell, BaseModel)
