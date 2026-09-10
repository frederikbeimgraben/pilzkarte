"""Vertrag der Marker."""

from app.models import Marker
from app.shared.schemas import (
    BasisModell,
    Breitengrad,
    Farbe,
    Laengengrad,
    Name,
    Notiz,
    Sichtbarkeit,
    Zeitpunkt,
)


class MarkerEingabe(BasisModell):
    """Ein neuer Marker."""

    name: Name
    lat: Breitengrad
    lon: Laengengrad
    farbe: Farbe = Farbe.GRUEN
    notiz: Notiz | None = None
    sichtbarkeit: Sichtbarkeit = Sichtbarkeit.PRIVAT


class MarkerAenderung(BasisModell):
    """Was sich an einem Marker aendern laesst. Weggelassene Felder bleiben."""

    name: Name | None = None
    lat: Breitengrad | None = None
    lon: Laengengrad | None = None
    farbe: Farbe | None = None
    notiz: Notiz | None = None
    sichtbarkeit: Sichtbarkeit | None = None


class MarkerAus(BasisModell):
    """Ein eigener Marker."""

    id: str
    name: str
    lat: float
    lon: float
    farbe: Farbe
    notiz: str | None
    sichtbarkeit: Sichtbarkeit
    erstellt_am: Zeitpunkt
    geaendert_am: Zeitpunkt


def marker_aus(marker: Marker) -> MarkerAus:
    """Baut die Antwort zu einem Marker."""
    return MarkerAus(
        id=marker.id,
        name=marker.name,
        lat=marker.lat,
        lon=marker.lon,
        farbe=marker.farbe,
        notiz=marker.notiz,
        sichtbarkeit=marker.sichtbarkeit,
        erstellt_am=marker.erstellt_am,
        geaendert_am=marker.geaendert_am,
    )
