"""Basis-Modell und gemeinsame Typen fuer den Vertrag zum Frontend."""

from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.shared import geometrie


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


class Sichtbarkeit(StrEnum):
    """Wer ein Objekt sehen darf."""

    PRIVAT = "privat"
    GETEILT = "geteilt"


class Regel(StrEnum):
    """Wie die Kombination ihre Faktoren verrechnet.

    ``schnitt`` faerbt, wo jede Bedingung zutrifft. ``abgestuft`` zeigt das
    geometrische Mittel der Erfuellungsgrade, so bleibt sichtbar, wo es knapp
    ist. Die Spalte in ``models.py`` baut auf diesem Enum auf.
    """

    SCHNITT = "schnitt"
    ABGESTUFT = "abgestuft"


class Farbe(StrEnum):
    """Die sechs Farben aus den Mockups. Eine freie Farbwahl gibt es nicht."""

    GRUEN = "gruen"
    BRAUN = "braun"
    BLAU = "blau"
    ROT = "rot"
    GOLD = "gold"
    GRAU = "grau"


# Jede Koordinate des Dienstes liegt in Deutschland. Die Grenzen stehen einmal
# in ``app.shared.geometrie``, damit Punkt und Polygon dieselbe Regel tragen.
Breitengrad = Annotated[float, Field(ge=geometrie.BREITE_MIN, le=geometrie.BREITE_MAX)]
Laengengrad = Annotated[float, Field(ge=geometrie.LAENGE_MIN, le=geometrie.LAENGE_MAX)]


def _nicht_in_der_zukunft(wert: date) -> date:
    # Ein Fund, den es noch nicht gibt, ist keiner. Gerechnet wird in UTC, weil
    # der Dienst keine Zeitzone des Geraets kennt.
    if wert > datetime.now(UTC).date():
        raise ValueError("Das Datum liegt in der Zukunft.")
    return wert


Funddatum = Annotated[date, AfterValidator(_nicht_in_der_zukunft)]

Name = Annotated[str, Field(min_length=1, max_length=80)]
Notiz = Annotated[str, Field(max_length=2000)]
Anzahl = Annotated[int, Field(ge=1, le=10_000)]


class GeoPolygon(BasisModell):
    """Eine Flaeche als GeoJSON, mit genau einem Ring und ohne Loecher.

    Der Ring kommt offen oder geschlossen herein und geht immer geschlossen
    heraus. Punkte in umgekehrter Richtung sind erlaubt; die Flaeche rechnet mit
    dem Betrag.
    """

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[tuple[Laengengrad, Breitengrad]]] = Field(min_length=1, max_length=1)

    @property
    def ring(self) -> list[geometrie.Punkt]:
        """Der geschlossene Ring der Flaeche."""
        return list(self.coordinates[0])

    @model_validator(mode="after")
    def _ring_pruefen(self) -> "GeoPolygon":
        geschlossen = geometrie.ring_normieren(self.coordinates[0])
        if not geometrie.ist_einfach(geschlossen):
            raise ValueError("Die Flaeche ueberschneidet sich selbst.")
        if geometrie.flaeche_ha(geschlossen) <= 0:
            raise ValueError("Die Eckpunkte liegen auf einer Linie und spannen keine Flaeche auf.")
        self.coordinates = [geschlossen]
        return self
