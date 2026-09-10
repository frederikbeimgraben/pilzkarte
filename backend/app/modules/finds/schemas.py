"""Vertrag der Funde: was hereinkommt, was hinausgeht.

Jede Zahl nennt, worauf sie sich bezieht: ``anzahl`` sind Fruchtkoerper am
Fundort, ``breite`` und ``hoehe`` sind Bildpunkte des abgelegten Fotos.
"""

from pydantic import Field

from app.models import Find, Photo
from app.shared.geometry import Point
from app.shared.schemas import (
    BaseSchema,
    Count,
    FindDate,
    Latitude,
    Longitude,
    Note,
    Timestamp,
    Visibility,
)


class PhotoOut(BaseSchema):
    """Ein abgelegtes Foto. Die Datei holt der Client ueber die eigene Route."""

    id: str
    width: int = Field(validation_alias="breite", serialization_alias="breite")
    height: int = Field(validation_alias="hoehe", serialization_alias="hoehe")
    created_at: Timestamp = Field(validation_alias="erstelltAm", serialization_alias="erstelltAm")


class FindIn(BaseSchema):
    """Ein neuer Fund."""

    species_slug: str = Field(validation_alias="artSlug", serialization_alias="artSlug")
    lat: Latitude
    lon: Longitude
    found_on: FindDate = Field(validation_alias="datum", serialization_alias="datum")
    count: Count | None = Field(
        default=None, validation_alias="anzahl", serialization_alias="anzahl"
    )
    note: Note | None = Field(default=None, validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility = Field(
        default=Visibility.PRIVATE,
        validation_alias="sichtbarkeit",
        serialization_alias="sichtbarkeit",
    )
    # Getrennt von der Sichtbarkeit: geteilt heisst gerundet fuer die anderen,
    # fuer das Training zaehlt nur der genaue Punkt.
    for_training: bool = Field(
        default=False, validation_alias="fuerTraining", serialization_alias="fuerTraining"
    )


class FindPatch(BaseSchema):
    """Was sich an einem Fund aendern laesst. Weggelassene Felder bleiben."""

    species_slug: str | None = Field(
        default=None, validation_alias="artSlug", serialization_alias="artSlug"
    )
    lat: Latitude | None = None
    lon: Longitude | None = None
    found_on: FindDate | None = Field(
        default=None, validation_alias="datum", serialization_alias="datum"
    )
    count: Count | None = Field(
        default=None, validation_alias="anzahl", serialization_alias="anzahl"
    )
    note: Note | None = Field(default=None, validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility | None = Field(
        default=None, validation_alias="sichtbarkeit", serialization_alias="sichtbarkeit"
    )
    for_training: bool | None = Field(
        default=None, validation_alias="fuerTraining", serialization_alias="fuerTraining"
    )


class FindOut(BaseSchema):
    """Ein eigener Fund, mit genauem Ort."""

    id: str
    species_slug: str = Field(validation_alias="artSlug", serialization_alias="artSlug")
    lat: float
    lon: float
    found_on: FindDate = Field(validation_alias="datum", serialization_alias="datum")
    count: int | None = Field(validation_alias="anzahl", serialization_alias="anzahl")
    note: str | None = Field(validation_alias="notiz", serialization_alias="notiz")
    visibility: Visibility = Field(
        validation_alias="sichtbarkeit", serialization_alias="sichtbarkeit"
    )
    for_training: bool = Field(validation_alias="fuerTraining", serialization_alias="fuerTraining")
    photos: list[PhotoOut] = Field(validation_alias="fotos", serialization_alias="fotos")
    created_at: Timestamp = Field(validation_alias="erstelltAm", serialization_alias="erstelltAm")
    updated_at: Timestamp = Field(validation_alias="geaendertAm", serialization_alias="geaendertAm")


class SharedFind(BaseSchema):
    """Ein geteilter Fund, so wie ihn ein anderes Konto sehen darf.

    ``gerundet`` sagt, ob der Ort auf ein 5-km-Raster gelegt wurde. Das ist bei
    geschuetzten Arten immer so, ausser der Fund gehoert der fragenden Person.
    """

    id: str
    species_slug: str = Field(validation_alias="artSlug", serialization_alias="artSlug")
    lat: float
    lon: float
    rounded: bool = Field(validation_alias="gerundet", serialization_alias="gerundet")
    found_on: FindDate = Field(validation_alias="datum", serialization_alias="datum")
    count: int | None = Field(validation_alias="anzahl", serialization_alias="anzahl")
    note: str | None = Field(validation_alias="notiz", serialization_alias="notiz")
    reporter: str | None = Field(validation_alias="melder", serialization_alias="melder")
    own: bool = Field(validation_alias="eigen", serialization_alias="eigen")
    photos: int = Field(validation_alias="fotos", serialization_alias="fotos")


def photo_out(photo: Photo) -> PhotoOut:
    """Baut die Antwort zu einem Foto."""
    return PhotoOut(
        id=photo.id, width=photo.width, height=photo.height, created_at=photo.created_at
    )


def find_out(find: Find) -> FindOut:
    """Baut die Antwort zu einem eigenen Fund."""
    return FindOut(
        id=find.id,
        species_slug=find.species_slug,
        lat=find.lat,
        lon=find.lon,
        found_on=find.found_on,
        count=find.count,
        note=find.note,
        visibility=find.visibility,
        for_training=find.for_training,
        photos=[photo_out(photo) for photo in find.photos],
        created_at=find.created_at,
        updated_at=find.updated_at,
    )


def shared_find_out(find: Find, place: Point, *, rounded: bool, own: bool) -> SharedFind:
    """Baut die Antwort zu einem geteilten Fund an einem moeglicherweise groben Ort."""
    return SharedFind(
        id=find.id,
        species_slug=find.species_slug,
        lon=place[0],
        lat=place[1],
        rounded=rounded,
        found_on=find.found_on,
        count=find.count,
        note=find.note,
        reporter=find.owner_name,
        own=own,
        photos=len(find.photos),
    )
