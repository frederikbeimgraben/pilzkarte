"""Vertrag der Artbilder: was hereinkommt, was hinausgeht.

Fotograf und Lizenz sind Pflicht. Sie stehen darum nicht als freie Zeichenkette
im Vertrag, sondern als gepruefte Felder: ein Bild ohne Urheber darf die App
nicht zeigen, und ein leerer Name ist kein Urheber.
"""

from datetime import date
from typing import Annotated, Self

from fastapi import UploadFile
from pydantic import AfterValidator, BeforeValidator, Field, model_validator

from app.models import SpeciesImage
from app.shared.images import Size
from app.shared.schemas import BaseSchema, ImageState, Licence, Timestamp

# Der Pfad, unter dem eine Bilddatei liegt. Der Client baut ihn nicht selbst
# zusammen, er bekommt ihn fertig in der Antwort.
PREFIX = "/api/species-images"


def _filled(value: str) -> str:
    """Weist eine Angabe zurueck, die nur aus Leerzeichen besteht."""
    stripped = value.strip()
    if not stripped:
        raise ValueError("Diese Angabe darf nicht leer sein.")
    return stripped


def _none_if_blank(value: str | None) -> str | None:
    # Ein Formularfeld, das niemand ausgefuellt hat, kommt als leere
    # Zeichenkette an. In der Datenbank ist das nichts und nicht "".
    return None if value is None or not value.strip() else value.strip()


Photographer = Annotated[str, AfterValidator(_filled), Field(max_length=120)]
Reason = Annotated[str, AfterValidator(_filled), Field(max_length=200)]
# Die Laenge steht am ``str`` und nicht am Ganzen: eine Grenze laesst sich
# nicht auf ``None`` anwenden.
Source = Annotated[Annotated[str, Field(max_length=400)] | None, BeforeValidator(_none_if_blank)]
Caption = Annotated[Annotated[str, Field(max_length=200)] | None, BeforeValidator(_none_if_blank)]
Slug = Annotated[str, Field(min_length=1, max_length=80)]


class ImageIn(BaseSchema):
    """Ein neues Bild samt seiner Herkunft.

    Die Datei steht im selben Modell wie die Angaben: FastAPI liest ein
    Formular entweder ganz in ein Modell oder ganz in einzelne Parameter,
    nicht halb und halb.
    """

    file: Annotated[UploadFile, Field(description="JPEG oder WebP, hoechstens 3 MB")]
    species_slug: Slug
    photographer: Photographer
    licence: Licence
    source: Source = None
    taken_on: date | None = None
    caption: Caption = None
    # Nur ein freigegebenes Bild kann Titelbild sein. Auf einer Einreichung
    # bleibt der Wunsch unbeachtet, bis jemand sie freigibt.
    lead: bool = False


class ImagePatch(BaseSchema):
    """Was sich an einem Bild spaeter noch aendern laesst."""

    photographer: Photographer | None = None
    licence: Licence | None = None
    source: Source = None
    taken_on: date | None = None
    caption: Caption = None
    lead: bool | None = None

    @model_validator(mode="after")
    def _provenance_stays(self) -> Self:
        # Ein Feld auf ``null`` leert es. Bei Fotograf und Lizenz waere das ein
        # Bild ohne Urheber, und genau das soll es nicht geben.
        for field in ("photographer", "licence"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} ist Pflicht und laesst sich nicht leeren.")
        return self


class Rejection(BaseSchema):
    """Die Absage einer Einreichung. Ohne Grund geht sie nicht hinaus."""

    reason: Reason


class ImageOut(BaseSchema):
    """Ein freigegebenes Bild, so wie es an der Art steht."""

    id: str
    species_slug: str
    photographer: str
    licence: Licence
    source: str | None
    taken_on: date | None
    caption: str | None
    lead: bool
    width: int
    height: int
    url: str
    thumb_url: str


class SubmissionOut(ImageOut):
    """Ein Bild samt seinem Zustand, fuer den Eingang und fuer "Meine Bilder"."""

    state: ImageState
    reject_reason: str | None
    submitted_by: str | None
    submitted_at: Timestamp


def file_url(image_id: str, size: Size) -> str:
    """Der Pfad, unter dem eine Fassung des Bildes liegt."""
    return f"{PREFIX}/{image_id}/{size.value}"


def image_out(image: SpeciesImage) -> ImageOut:
    """Baut die oeffentliche Antwort zu einem Bild."""
    return ImageOut(
        id=image.id,
        species_slug=image.species_slug,
        photographer=image.photographer,
        licence=image.licence,
        source=image.source,
        taken_on=image.taken_on,
        caption=image.caption,
        lead=image.lead,
        width=image.width,
        height=image.height,
        url=file_url(image.id, Size.FULL),
        thumb_url=file_url(image.id, Size.THUMB),
    )


def submission_out(image: SpeciesImage, submitted_by: str | None = None) -> SubmissionOut:
    """Baut die Antwort samt Zustand. Den Namen kennt nur, wer die Person nachlaedt."""
    return SubmissionOut(
        **image_out(image).model_dump(),
        state=image.state,
        reject_reason=image.reject_reason,
        submitted_by=submitted_by,
        submitted_at=image.created_at,
    )
