"""Vertrag der Zonen und ihres Wertes.

``flaecheHa`` rechnet der Dienst aus dem Polygon, nie das Geraet.
``flaechenmittel`` ist das Mittel der Vorhersage ueber die Flaeche, in Prozent
je Begehung, fuer genau die genannte Art und Woche.
"""

from pydantic import Field

from app.models import Zone
from app.shared.schemas import (
    BaseSchema,
    Color,
    GeoPolygon,
    Name,
    Note,
    Timestamp,
    Visibility,
    Week,
)


class ZoneIn(BaseSchema):
    """Eine neue Zone."""

    name: Name
    polygon: GeoPolygon
    color: Color = Field(default=Color.GREEN, validation_alias="farbe", serialization_alias="farbe")
    note: Note | None = Field(default=None, validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility = Field(
        default=Visibility.PRIVATE,
        validation_alias="sichtbarkeit",
        serialization_alias="sichtbarkeit",
    )


class ZonePatch(BaseSchema):
    """Was sich an einer Zone aendern laesst. Weggelassene Felder bleiben."""

    name: Name | None = None
    polygon: GeoPolygon | None = None
    color: Color | None = Field(default=None, validation_alias="farbe", serialization_alias="farbe")
    note: Note | None = Field(default=None, validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility | None = Field(
        default=None, validation_alias="sichtbarkeit", serialization_alias="sichtbarkeit"
    )


class ZoneOut(BaseSchema):
    """Eine eigene Zone."""

    id: str
    name: str
    polygon: GeoPolygon
    area_ha: float = Field(validation_alias="flaecheHa", serialization_alias="flaecheHa")
    color: Color = Field(validation_alias="farbe", serialization_alias="farbe")
    note: str | None = Field(validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility = Field(
        validation_alias="sichtbarkeit", serialization_alias="sichtbarkeit"
    )
    created_at: Timestamp = Field(validation_alias="erstelltAm", serialization_alias="erstelltAm")
    updated_at: Timestamp = Field(validation_alias="geaendertAm", serialization_alias="geaendertAm")


class ZoneValue(BaseSchema):
    """Was die Karte einer Zone fuer eine Art und eine Woche zurueckgibt."""

    species: str = Field(validation_alias="art", serialization_alias="art")
    week: Week = Field(validation_alias="woche", serialization_alias="woche")
    area_mean: float = Field(
        validation_alias="flaechenmittel", serialization_alias="flaechenmittel"
    )
    points: int = Field(validation_alias="punkte", serialization_alias="punkte")
    own_finds: int = Field(validation_alias="eigeneFunde", serialization_alias="eigeneFunde")


def zone_out(zone: Zone) -> ZoneOut:
    """Baut die Antwort zu einer Zone. Das Polygon liegt als GeoJSON-Text in der Spalte."""
    return ZoneOut(
        id=zone.id,
        name=zone.name,
        polygon=GeoPolygon.model_validate_json(zone.polygon),
        area_ha=zone.area_ha,
        color=zone.color,
        note=zone.note,
        visibility=zone.visibility,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )
