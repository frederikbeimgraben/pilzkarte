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

from app.models import Kombination
from app.shared.schemas import BasisModell, Name, Regel, Zeitpunkt

# Mehr Faktoren macht die Karte nicht klueger, nur die Adresse laenger. Acht
# reichen fuer jede Frage, die das Konzept nennt.
FAKTOREN_HOECHSTENS: Final = 8


class Bedingung(StrEnum):
    """Die drei Formen einer Bedingung. Alle drei sind eine Spanne der Skala."""

    UNTER = "unter"
    UEBER = "ueber"
    ZWISCHEN = "zwischen"


# Dasselbe Muster wie in der Adresse des Frontends: Kleinbuchstaben, Ziffern
# und Unterstrich. Ein Slug der Kette sieht immer so aus.
Quellenname = Annotated[str, Field(min_length=1, max_length=40, pattern=r"^[a-z0-9_]+$")]


class Faktor(BasisModell):
    """Eine Quelle mit einer Bedingung."""

    quelle: Quellenname
    bedingung: Bedingung
    von: float | None = None
    bis: float | None = None
    # Ein abgehakter Faktor bleibt gespeichert. Sonst waere er beim naechsten
    # Oeffnen verloren, statt nur ausgeschaltet.
    aktiv: bool = True

    @model_validator(mode="after")
    def _grenzen_passen_zur_bedingung(self) -> "Faktor":
        if self.bedingung is Bedingung.ZWISCHEN:
            if self.von is None or self.bis is None:
                raise ValueError("Die Bedingung zwischen braucht von und bis.")
            if self.von > self.bis:
                raise ValueError("Bei zwischen liegt von nicht ueber bis.")
            return self
        if self.bedingung is Bedingung.UEBER:
            gesetzt, leer, namen = self.von, self.bis, ("von", "bis")
        else:
            gesetzt, leer, namen = self.bis, self.von, ("bis", "von")
        if gesetzt is None:
            raise ValueError(f"Die Bedingung {self.bedingung} braucht {namen[0]}.")
        if leer is not None:
            raise ValueError(f"Die Bedingung {self.bedingung} kennt kein {namen[1]}.")
        return self


Faktorliste = Annotated[list[Faktor], Field(min_length=1, max_length=FAKTOREN_HOECHSTENS)]

# Die Spalte haelt die Faktoren als JSON-Text. Der Adapter ist der einzige Weg
# hinein und heraus, damit beide Richtungen dasselbe Schema pruefen.
FAKTOREN_ADAPTER: Final = TypeAdapter(list[Faktor])


class KombinationEingabe(BasisModell):
    """Eine neue Kombination."""

    name: Name
    regel: Regel = Regel.SCHNITT
    faktoren: Faktorliste


class KombinationAenderung(BasisModell):
    """Was sich aendern laesst. Weggelassene Felder bleiben."""

    name: Name | None = None
    regel: Regel | None = None
    faktoren: Faktorliste | None = None


class KombinationAus(BasisModell):
    """Eine eigene Kombination."""

    id: str
    name: str
    regel: Regel
    faktoren: list[Faktor]
    erstellt_am: Zeitpunkt
    geaendert_am: Zeitpunkt


def faktoren_lesen(text: str) -> list[Faktor]:
    """Liest die Faktoren aus der Textspalte."""
    return FAKTOREN_ADAPTER.validate_json(text)


def faktoren_schreiben(faktoren: list[Faktor]) -> str:
    """Schreibt die Faktoren fuer die Textspalte."""
    return FAKTOREN_ADAPTER.dump_json(faktoren).decode()


def kombination_aus(kombination: Kombination) -> KombinationAus:
    """Baut die Antwort zu einer Kombination."""
    return KombinationAus(
        id=kombination.id,
        name=kombination.name,
        regel=kombination.regel,
        faktoren=faktoren_lesen(kombination.faktoren),
        erstellt_am=kombination.erstellt_am,
        geaendert_am=kombination.geaendert_am,
    )
