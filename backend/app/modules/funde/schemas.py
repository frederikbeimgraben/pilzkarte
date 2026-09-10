"""Vertrag der Funde: was hereinkommt, was hinausgeht.

Jede Zahl nennt, worauf sie sich bezieht: ``anzahl`` sind Fruchtkoerper am
Fundort, ``breite`` und ``hoehe`` sind Bildpunkte des abgelegten Fotos.
"""

from app.models import Foto, Fund
from app.shared.geometrie import Punkt
from app.shared.schemas import (
    Anzahl,
    BasisModell,
    Breitengrad,
    Funddatum,
    Laengengrad,
    Notiz,
    Sichtbarkeit,
    Zeitpunkt,
)


class FotoAus(BasisModell):
    """Ein abgelegtes Foto. Die Datei holt der Client ueber die eigene Route."""

    id: str
    breite: int
    hoehe: int
    erstellt_am: Zeitpunkt


class FundEingabe(BasisModell):
    """Ein neuer Fund."""

    art_slug: str
    lat: Breitengrad
    lon: Laengengrad
    datum: Funddatum
    anzahl: Anzahl | None = None
    notiz: Notiz | None = None
    sichtbarkeit: Sichtbarkeit = Sichtbarkeit.PRIVAT


class FundAenderung(BasisModell):
    """Was sich an einem Fund aendern laesst. Weggelassene Felder bleiben."""

    art_slug: str | None = None
    lat: Breitengrad | None = None
    lon: Laengengrad | None = None
    datum: Funddatum | None = None
    anzahl: Anzahl | None = None
    notiz: Notiz | None = None
    sichtbarkeit: Sichtbarkeit | None = None


class FundAus(BasisModell):
    """Ein eigener Fund, mit genauem Ort."""

    id: str
    art_slug: str
    lat: float
    lon: float
    datum: Funddatum
    anzahl: int | None
    notiz: str | None
    sichtbarkeit: Sichtbarkeit
    fotos: list[FotoAus]
    erstellt_am: Zeitpunkt
    geaendert_am: Zeitpunkt


class GeteilterFund(BasisModell):
    """Ein geteilter Fund, so wie ihn ein anderes Konto sehen darf.

    ``gerundet`` sagt, ob der Ort auf ein 5-km-Raster gelegt wurde. Das ist bei
    geschuetzten Arten immer so, ausser der Fund gehoert der fragenden Person.
    """

    id: str
    art_slug: str
    lat: float
    lon: float
    gerundet: bool
    datum: Funddatum
    anzahl: int | None
    notiz: str | None
    melder: str | None
    eigen: bool
    fotos: int


def foto_aus(foto: Foto) -> FotoAus:
    """Baut die Antwort zu einem Foto."""
    return FotoAus(id=foto.id, breite=foto.breite, hoehe=foto.hoehe, erstellt_am=foto.erstellt_am)


def fund_aus(fund: Fund) -> FundAus:
    """Baut die Antwort zu einem eigenen Fund."""
    return FundAus(
        id=fund.id,
        art_slug=fund.art_slug,
        lat=fund.lat,
        lon=fund.lon,
        datum=fund.datum,
        anzahl=fund.anzahl,
        notiz=fund.notiz,
        sichtbarkeit=fund.sichtbarkeit,
        fotos=[foto_aus(foto) for foto in fund.fotos],
        erstellt_am=fund.erstellt_am,
        geaendert_am=fund.geaendert_am,
    )


def geteilter_fund_aus(fund: Fund, ort: Punkt, *, gerundet: bool, eigen: bool) -> GeteilterFund:
    """Baut die Antwort zu einem geteilten Fund an einem moeglicherweise groben Ort."""
    return GeteilterFund(
        id=fund.id,
        art_slug=fund.art_slug,
        lon=ort[0],
        lat=ort[1],
        gerundet=gerundet,
        datum=fund.datum,
        anzahl=fund.anzahl,
        notiz=fund.notiz,
        melder=fund.besitzer_name,
        eigen=eigen,
        fotos=len(fund.fotos),
    )
