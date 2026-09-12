"""Basis-Modell und gemeinsame Typen fuer den Vertrag zum Frontend."""

from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.shared import geometry


def to_camel(name: str) -> str:
    """Wandelt einen Feldnamen in camelCase, wie ihn das JSON traegt."""
    header, *rest = name.split("_")
    return header + "".join(part.capitalize() for part in rest)


def _with_timezone(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Der Zeitpunkt braucht eine Zeitzone.")
    return value


# Ein Zeitpunkt ohne Zeitzone vergleicht sich falsch, sobald er auf einen
# bewussten trifft. Der Vertrag laesst darum nur ISO-8601 mit Offset zu.
Timestamp = Annotated[datetime, AfterValidator(_with_timezone)]


class BaseSchema(BaseModel):
    """Gemeinsame Wurzel aller Modelle: camelCase im JSON, keine fremden Felder."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class Week(BaseSchema):
    """Eine ISO-Kalenderwoche, so wie sie auf dem Draht steht."""

    year: int = Field(validation_alias="jahr", serialization_alias="jahr")
    week: int = Field(validation_alias="woche", serialization_alias="woche")

    @model_validator(mode="after")
    def _must_exist(self) -> "Week":
        # Nur manche Jahre haben eine 53. Woche. fromisocalendar kennt die Regel.
        try:
            date.fromisocalendar(self.year, self.week, 1)
        except ValueError as error:
            raise ValueError(f"Die Woche {self.week} gibt es {self.year} nicht.") from error
        return self


class Visibility(StrEnum):
    """Wer ein Objekt sehen darf."""

    PRIVATE = "privat"
    SHARED = "geteilt"


class Rule(StrEnum):
    """Wie die Kombination ihre Faktoren verrechnet.

    ``schnitt`` faerbt, wo jede Bedingung zutrifft. ``abgestuft`` zeigt das
    geometrische Mittel der Erfuellungsgrade, so bleibt sichtbar, wo es knapp
    ist. Die Spalte in ``models.py`` baut auf diesem Enum auf.
    """

    INTERSECTION = "schnitt"
    GRADED = "abgestuft"


class Licence(StrEnum):
    """Unter welchem Recht ein Artbild steht.

    ``own`` heisst: die Person hat das Bild selbst aufgenommen und gibt es der
    App. Jeder andere Wert nennt die Lizenz, unter der das Bild schon steht.
    Eine freie Eingabe gibt es nicht, sonst stuende dort irgendwann "frei".
    """

    OWN = "own"
    CC0 = "cc0"
    CC_BY_4 = "cc-by-4"
    CC_BY_SA_4 = "cc-by-sa-4"
    PUBLIC_DOMAIN = "public-domain"


class ImageState(StrEnum):
    """Wo ein Artbild in der Pruefung steht."""

    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class Color(StrEnum):
    """Die sechs Farben aus den Mockups. Eine freie Farbwahl gibt es nicht."""

    GREEN = "gruen"
    BROWN = "braun"
    BLUE = "blau"
    RED = "rot"
    GOLD = "gold"
    GREY = "grau"


# Jede Koordinate des Dienstes liegt in Deutschland. Die Grenzen stehen einmal
# in ``app.shared.geometrie``, damit Punkt und Polygon dieselbe Regel tragen.
Latitude = Annotated[float, Field(ge=geometry.LAT_MIN, le=geometry.LAT_MAX)]
Longitude = Annotated[float, Field(ge=geometry.LON_MIN, le=geometry.LON_MAX)]


def _not_in_the_future(value: date) -> date:
    # Ein Fund, den es noch nicht gibt, ist keiner. Gerechnet wird in UTC, weil
    # der Dienst keine Zeitzone des Geraets kennt.
    if value > datetime.now(UTC).date():
        raise ValueError("Das Datum liegt in der Zukunft.")
    return value


FindDate = Annotated[date, AfterValidator(_not_in_the_future)]

Name = Annotated[str, Field(min_length=1, max_length=80)]
Note = Annotated[str, Field(max_length=2000)]
Count = Annotated[int, Field(ge=1, le=10_000)]


class GeoPolygon(BaseSchema):
    """Eine Flaeche als GeoJSON, mit genau einem Ring und ohne Loecher.

    Der Ring kommt offen oder geschlossen herein und geht immer geschlossen
    heraus. Punkte in umgekehrter Richtung sind erlaubt; die Flaeche rechnet mit
    dem Betrag.
    """

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[tuple[Longitude, Latitude]]] = Field(min_length=1, max_length=1)

    @property
    def ring(self) -> list[geometry.Point]:
        """Der geschlossene Ring der Flaeche."""
        return list(self.coordinates[0])

    @model_validator(mode="after")
    def _check_ring(self) -> "GeoPolygon":
        closed = geometry.close_ring(self.coordinates[0])
        if not geometry.is_simple(closed):
            raise ValueError("Die Flaeche ueberschneidet sich selbst.")
        if geometry.area_ha(closed) <= 0:
            raise ValueError("Die Eckpunkte liegen auf einer Linie und spannen keine Flaeche auf.")
        self.coordinates = [closed]
        return self
