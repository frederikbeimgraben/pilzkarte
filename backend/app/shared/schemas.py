"""Basis-Modell und gemeinsame Typen fuer den Vertrag zum Frontend."""

from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, model_validator


def zu_camel(name: str) -> str:
    """Wandelt einen Feldnamen in camelCase, wie ihn das JSON traegt."""
    kopf, *rest = name.split("_")
    return kopf + "".join(teil.capitalize() for teil in rest)


def _mit_zeitzone(wert: datetime) -> datetime:
    if wert.tzinfo is None:
        raise ValueError("Der Zeitpunkt braucht eine Zeitzone.")
    return wert


# Ein Zeitpunkt ohne Zeitzone vergleicht sich falsch, sobald er auf einen
# bewussten trifft. Der Vertrag laesst darum nur ISO-8601 mit Offset zu.
Zeitpunkt = Annotated[datetime, AfterValidator(_mit_zeitzone)]


class BasisModell(BaseModel):
    """Gemeinsame Wurzel aller Modelle: camelCase im JSON, keine fremden Felder."""

    model_config = ConfigDict(
        alias_generator=zu_camel,
        populate_by_name=True,
        extra="forbid",
    )


class Woche(BasisModell):
    """Eine ISO-Kalenderwoche, so wie sie auf dem Draht steht."""

    jahr: int
    woche: int

    @model_validator(mode="after")
    def _muss_es_geben(self) -> "Woche":
        # Nur manche Jahre haben eine 53. Woche. fromisocalendar kennt die Regel.
        try:
            date.fromisocalendar(self.jahr, self.woche, 1)
        except ValueError as fehler:
            raise ValueError(f"Die Woche {self.woche} gibt es {self.jahr} nicht.") from fehler
        return self
