"""Vertrag der Marker."""

from pydantic import Field

from app.models import Marker
from app.shared.schemas import (
    BaseSchema,
    Color,
    Latitude,
    Longitude,
    Name,
    Note,
    Timestamp,
    Visibility,
)


class MarkerIn(BaseSchema):
    """Ein neuer Marker."""

    name: Name
    lat: Latitude
    lon: Longitude
    color: Color = Field(default=Color.GREEN, validation_alias="farbe", serialization_alias="farbe")
    note: Note | None = Field(default=None, validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility = Field(
        default=Visibility.PRIVATE,
        validation_alias="sichtbarkeit",
        serialization_alias="sichtbarkeit",
    )


class MarkerPatch(BaseSchema):
    """Was sich an einem Marker aendern laesst. Weggelassene Felder bleiben."""

    name: Name | None = None
    lat: Latitude | None = None
    lon: Longitude | None = None
    color: Color | None = Field(default=None, validation_alias="farbe", serialization_alias="farbe")
    note: Note | None = Field(default=None, validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility | None = Field(
        default=None, validation_alias="sichtbarkeit", serialization_alias="sichtbarkeit"
    )


class MarkerOut(BaseSchema):
    """Ein eigener Marker."""

    id: str
    name: str
    lat: float
    lon: float
    color: Color = Field(validation_alias="farbe", serialization_alias="farbe")
    note: str | None = Field(validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility = Field(
        validation_alias="sichtbarkeit", serialization_alias="sichtbarkeit"
    )
    created_at: Timestamp = Field(validation_alias="erstelltAm", serialization_alias="erstelltAm")
    updated_at: Timestamp = Field(validation_alias="geaendertAm", serialization_alias="geaendertAm")


def marker_out(marker: Marker) -> MarkerOut:
    """Baut die Antwort zu einem Marker."""
    return MarkerOut(
        id=marker.id,
        name=marker.name,
        lat=marker.lat,
        lon=marker.lon,
        color=marker.color,
        note=marker.note,
        visibility=marker.visibility,
        created_at=marker.created_at,
        updated_at=marker.updated_at,
    )
