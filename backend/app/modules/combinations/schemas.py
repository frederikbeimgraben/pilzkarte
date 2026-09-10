"""Vertrag der Kombinationen.

Ein Faktor ist eine Quelle mit einer Bedingung. Die Bedingung nennt nur die
Grenze, die sie braucht: ``unter`` traegt ``bis``, ``ueber`` traegt ``von``,
``zwischen`` beide. Die jeweils andere Grenze bleibt leer, weil eine Zahl
dort nichts messen wuerde. Beide Grenzen stehen in der Einheit der Quelle, so
wie ``layers.json`` sie fuehrt.
"""

from enum import StrEnum
from typing import Annotated, Final

from pydantic import Field, TypeAdapter, model_validator

from app.models import Combination
from app.shared.schemas import BaseSchema, Name, Rule, Timestamp

# Mehr Faktoren macht die Karte nicht klueger, nur die Adresse laenger. Acht
# reichen fuer jede Frage, die das Konzept nennt.
FACTORS_MAX: Final = 8


class Condition(StrEnum):
    """Die drei Formen einer Bedingung. Alle drei sind eine Spanne der Skala."""

    BELOW = "unter"
    ABOVE = "ueber"
    BETWEEN = "zwischen"


# Dasselbe Muster wie in der Adresse des Frontends: Kleinbuchstaben, Ziffern
# und Unterstrich. Ein Slug der Kette sieht immer so aus.
SourceName = Annotated[str, Field(min_length=1, max_length=40, pattern=r"^[a-z0-9_]+$")]


class Factor(BaseSchema):
    """Eine Quelle mit einer Bedingung."""

    source: SourceName = Field(validation_alias="quelle", serialization_alias="quelle")
    condition: Condition = Field(validation_alias="bedingung", serialization_alias="bedingung")
    low: float | None = Field(default=None, validation_alias="von", serialization_alias="von")
    high: float | None = Field(default=None, validation_alias="bis", serialization_alias="bis")
    # Ein abgehakter Faktor bleibt gespeichert. Sonst waere er beim naechsten
    # Oeffnen verloren, statt nur ausgeschaltet.
    active: bool = Field(default=True, validation_alias="aktiv", serialization_alias="aktiv")

    @model_validator(mode="after")
    def _bounds_match_condition(self) -> "Factor":
        if self.condition is Condition.BETWEEN:
            if self.low is None or self.high is None:
                raise ValueError("Die Bedingung zwischen braucht von und bis.")
            if self.low > self.high:
                raise ValueError("Bei zwischen liegt von nicht ueber bis.")
            return self
        if self.condition is Condition.ABOVE:
            used, empty, names = self.low, self.high, ("von", "bis")
        else:
            used, empty, names = self.high, self.low, ("bis", "von")
        if used is None:
            raise ValueError(f"Die Bedingung {self.condition} braucht {names[0]}.")
        if empty is not None:
            raise ValueError(f"Die Bedingung {self.condition} kennt kein {names[1]}.")
        return self


FactorList = Annotated[list[Factor], Field(min_length=1, max_length=FACTORS_MAX)]

# Die Spalte haelt die Faktoren als JSON-Text. Der Adapter ist der einzige Weg
# hinein und heraus, damit beide Richtungen dasselbe Schema pruefen.
FACTORS_ADAPTER: Final = TypeAdapter(list[Factor])


class CombinationIn(BaseSchema):
    """Eine neue Kombination."""

    name: Name
    rule: Rule = Field(
        default=Rule.INTERSECTION, validation_alias="regel", serialization_alias="regel"
    )
    factors: FactorList = Field(validation_alias="faktoren", serialization_alias="faktoren")


class CombinationPatch(BaseSchema):
    """Was sich aendern laesst. Weggelassene Felder bleiben."""

    name: Name | None = None
    rule: Rule | None = Field(default=None, validation_alias="regel", serialization_alias="regel")
    factors: FactorList | None = Field(
        default=None, validation_alias="faktoren", serialization_alias="faktoren"
    )


class CombinationOut(BaseSchema):
    """Eine eigene Kombination."""

    id: str
    name: str
    rule: Rule = Field(validation_alias="regel", serialization_alias="regel")
    factors: list[Factor] = Field(validation_alias="faktoren", serialization_alias="faktoren")
    created_at: Timestamp = Field(validation_alias="erstelltAm", serialization_alias="erstelltAm")
    updated_at: Timestamp = Field(validation_alias="geaendertAm", serialization_alias="geaendertAm")


def read_factors(text: str) -> list[Factor]:
    """Liest die Faktoren aus der Textspalte."""
    return FACTORS_ADAPTER.validate_json(text)


def write_factors(factors: list[Factor]) -> str:
    """Schreibt die Faktoren fuer die Textspalte."""
    return FACTORS_ADAPTER.dump_json(factors).decode()


def combination_out(combination: Combination) -> CombinationOut:
    """Baut die Antwort zu einer Kombination."""
    return CombinationOut(
        id=combination.id,
        name=combination.name,
        rule=combination.rule,
        factors=read_factors(combination.factors),
        created_at=combination.created_at,
        updated_at=combination.updated_at,
    )
