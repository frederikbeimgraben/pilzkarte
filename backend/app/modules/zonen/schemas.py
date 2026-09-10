"""Vertrag der Zonen und ihres Wertes.

``flaecheHa`` rechnet der Dienst aus dem Polygon, nie das Geraet.
``flaechenmittel`` ist das Mittel der Vorhersage ueber die Flaeche, in Prozent
je Begehung, fuer genau die genannte Art und Woche.
"""

from app.models import Zone
from app.shared.schemas import (
    BasisModell,
    Farbe,
    GeoPolygon,
    Name,
    Notiz,
    Sichtbarkeit,
    Woche,
    Zeitpunkt,
)


class ZoneEingabe(BasisModell):
    """Eine neue Zone."""

    name: Name
    polygon: GeoPolygon
    farbe: Farbe = Farbe.GRUEN
    notiz: Notiz | None = None
    sichtbarkeit: Sichtbarkeit = Sichtbarkeit.PRIVAT


class ZoneAenderung(BasisModell):
    """Was sich an einer Zone aendern laesst. Weggelassene Felder bleiben."""

    name: Name | None = None
    polygon: GeoPolygon | None = None
    farbe: Farbe | None = None
    notiz: Notiz | None = None
    sichtbarkeit: Sichtbarkeit | None = None


class ZoneAus(BasisModell):
    """Eine eigene Zone."""

    id: str
    name: str
    polygon: GeoPolygon
    flaeche_ha: float
    farbe: Farbe
    notiz: str | None
    sichtbarkeit: Sichtbarkeit
    erstellt_am: Zeitpunkt
    geaendert_am: Zeitpunkt


class ZonenWert(BasisModell):
    """Was die Karte einer Zone fuer eine Art und eine Woche zurueckgibt."""

    art: str
    woche: Woche
    flaechenmittel: float
    punkte: int
    eigene_funde: int


def zone_aus(zone: Zone) -> ZoneAus:
    """Baut die Antwort zu einer Zone. Das Polygon liegt als GeoJSON-Text in der Spalte."""
    return ZoneAus(
        id=zone.id,
        name=zone.name,
        polygon=GeoPolygon.model_validate_json(zone.polygon),
        flaeche_ha=zone.flaeche_ha,
        farbe=zone.farbe,
        notiz=zone.notiz,
        sichtbarkeit=zone.sichtbarkeit,
        erstellt_am=zone.erstellt_am,
        geaendert_am=zone.geaendert_am,
    )
