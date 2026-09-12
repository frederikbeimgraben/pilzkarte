"""Endpunkte der Artbilder.

Ein freigegebenes Bild liest jeder, auch ohne Konto. Alles Schreibende haengt
an einem Recht aus H1: ``image.upload`` veroeffentlicht, ``image.review``
prueft. Dazwischen steht die Einreichung: sie braucht nur ein Konto und wird
erst nach der Pruefung oeffentlich.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Form, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, current_user
from app.core.db import db_session
from app.core.errors import Conflict, Forbidden, NotFound, UnsupportedMediaType
from app.core.settings import Settings, get_settings
from app.models import SpeciesImage, utc_now
from app.modules.access.guard import Rights, Viewer, Visitor, requires
from app.modules.access.permissions import Permission
from app.modules.species.catalog import Catalog
from app.modules.species.dependencies import current_catalog
from app.modules.species_images import service
from app.modules.species_images.schemas import (
    ImageIn,
    ImageOut,
    ImagePatch,
    Rejection,
    SubmissionOut,
    image_out,
    submission_out,
)
from app.shared import images
from app.shared.images import Size
from app.shared.objects import apply_patch
from app.shared.paging import Page, Paging, load_page
from app.shared.schemas import ImageState

router = APIRouter(prefix="/species-images", tags=["species-images"])

Authenticated = Annotated[User, Depends(current_user)]
Session = Annotated[AsyncSession, Depends(db_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
CatalogDep = Annotated[Catalog, Depends(current_catalog)]
Uploads = Annotated[User, Depends(requires(Permission.IMAGE_UPLOAD))]
Reviews = Annotated[User, Depends(requires(Permission.IMAGE_REVIEW))]
Submitted = Annotated[ImageIn, Form()]


def checked(payload: ImageIn, catalog: Catalog, state: ImageState) -> service.Arrival:
    """Prueft, was der Dienst vor dem Oeffnen der Datei wissen muss.

    Der Ort geht schon hier durch das Raster. Weiter als bis hierher kommt der
    genaue Punkt nicht.
    """
    if payload.file.content_type not in images.MEDIA_TYPES:
        raise UnsupportedMediaType("Der Dienst nimmt nur JPEG und WebP an.")
    service.check_species(catalog, payload.species_slug)
    return service.Arrival(
        payload=payload,
        place=service.coarse_place(payload, catalog),
        state=state,
    )


async def with_names(session: AsyncSession, rows: list[SpeciesImage]) -> list[SubmissionOut]:
    """Baut die Antworten einer Liste und laedt die Namen in einem Zug."""
    names = await service.names_of(session, [row.uploader_sub for row in rows])
    return [submission_out(row, names.get(row.uploader_sub)) for row in rows]


async def one_submission(session: AsyncSession, image: SpeciesImage) -> SubmissionOut:
    """Baut die Antwort zu einem Bild samt dem Namen der einreichenden Person."""
    names = await service.names_of(session, [image.uploader_sub])
    return submission_out(image, names.get(image.uploader_sub))


def in_state(state: ImageState) -> Select[tuple[SpeciesImage]]:
    """Die Bilder eines Zustands, aelteste zuerst: der Eingang wird von vorn abgearbeitet."""
    return select(SpeciesImage).where(SpeciesImage.state == state).order_by(SpeciesImage.created_at)


@router.get("", summary="Die freigegebenen Bilder einer Art")
async def image_list(
    session: Session,
    species: Annotated[str, Query(description="Slug der Art")],
) -> list[ImageOut]:
    """Liefert die Bilder, die an der Art stehen. Das Titelbild fuehrt.

    Eine Art traegt eine Handvoll Bilder. Die Liste blaettert darum nicht.
    """
    query = (
        select(SpeciesImage)
        .where(
            SpeciesImage.species_slug == species,
            SpeciesImage.state == ImageState.APPROVED,
        )
        .order_by(SpeciesImage.lead.desc(), SpeciesImage.created_at)
    )
    return [image_out(row) for row in await session.scalars(query)]


@router.get("/submissions", summary="Der Eingang der Pruefung")
async def submission_list(
    session: Session,
    paging: Paging,
    _: Reviews,
    state: Annotated[ImageState, Query()] = ImageState.SUBMITTED,
) -> Page[SubmissionOut]:
    """Liefert die Einreichungen eines Zustands, aelteste zuerst."""
    page = await load_page(session, in_state(state), paging, lambda row: row)
    return Page(
        entries=await with_names(session, page.entries),
        total=page.total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/mine", summary="Die eigenen Einreichungen")
async def own_list(session: Session, paging: Paging, user: Authenticated) -> Page[SubmissionOut]:
    """Liefert die eigenen Bilder mit ihrem Zustand, neueste zuerst."""
    query = (
        select(SpeciesImage)
        .where(SpeciesImage.uploader_sub == user.sub)
        .order_by(SpeciesImage.created_at.desc())
    )
    page = await load_page(session, query, paging, lambda row: row)
    return Page(
        entries=await with_names(session, page.entries),
        total=page.total,
        limit=page.limit,
        offset=page.offset,
    )


@router.post("", status_code=status.HTTP_201_CREATED, summary="Bild veroeffentlichen")
async def create_image(
    session: Session,
    settings: SettingsDep,
    catalog: CatalogDep,
    user: Uploads,
    payload: Submitted,
) -> SubmissionOut:
    """Nimmt ein Bild an und stellt es sofort an die Art.

    Wer das Recht hat, Bilder hochzuladen, darf sie auch zeigen. Ein Umweg
    ueber die eigene Pruefung waere Theater.
    """
    image = await service.create(
        session,
        settings,
        checked(payload, catalog, ImageState.APPROVED),
        user,
    )
    return await one_submission(session, image)


@router.post(
    "/submissions",
    status_code=status.HTTP_201_CREATED,
    summary="Bild zur Pruefung einreichen",
)
async def create_submission(
    session: Session,
    settings: SettingsDep,
    catalog: CatalogDep,
    user: Authenticated,
    payload: Submitted,
) -> SubmissionOut:
    """Nimmt ein Bild an und legt es in den Eingang.

    Bis zur Freigabe sieht es nur, wer es eingereicht hat, und wer prueft.
    """
    image = await service.create(
        session,
        settings,
        checked(payload, catalog, ImageState.SUBMITTED),
        user,
    )
    return await one_submission(session, image)


@router.get("/{image_id}", summary="Ein Bild")
async def read_image(image_id: str, session: Session, visitor: Visitor) -> SubmissionOut:
    """Liefert die Angaben zu einem Bild, das dieser Zugriff sehen darf."""
    image = await service.visible(session, image_id, visitor)
    return await one_submission(session, image)


@router.get("/{image_id}/{size}", summary="Eine Fassung der Bilddatei")
async def read_file(
    image_id: str,
    size: Size,
    session: Session,
    settings: SettingsDep,
    visitor: Visitor,
) -> FileResponse:
    """Liefert die Bilddatei in der gewuenschten Groesse."""
    image = await service.visible(session, image_id, visitor)
    path = service.file_path(settings, image, size)
    if not path.is_file():
        raise NotFound("Diese Fassung des Bildes gibt es nicht.")
    return FileResponse(path, media_type="image/jpeg")


@router.patch("/{image_id}", summary="Angaben zu einem Bild aendern")
async def patch_image(
    image_id: str,
    patch: ImagePatch,
    session: Session,
    _: Uploads,
) -> SubmissionOut:
    """Aendert Herkunft, Angaben oder das Titelbild. Weggelassene Felder bleiben."""
    image = await service.image_or_404(session, image_id)
    apply_patch(image, patch)
    if image.lead and image.state is not ImageState.APPROVED:
        raise Conflict("Nur ein freigegebenes Bild kann Titelbild sein.")
    if image.lead:
        await service.clear_lead(session, image.species_slug, image.id)
    await session.commit()
    await session.refresh(image)
    return await one_submission(session, image)


@router.delete(
    "/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Bild loeschen",
)
async def delete_image(
    image_id: str,
    session: Session,
    settings: SettingsDep,
    user: Authenticated,
    rights: Rights,
) -> Response:
    """Loescht ein Bild samt seinen Dateien.

    Die eigene Einreichung nimmt jede Person zurueck. Ein fremdes Bild loescht
    nur, wer Bilder hochladen darf.
    """
    image = await service.visible(session, image_id, Viewer(user=user, rights=rights))
    if image.uploader_sub != user.sub and Permission.IMAGE_UPLOAD not in rights:
        raise Forbidden("Ein fremdes Bild loescht nur, wer Bilder hochladen darf.")
    service.remove_files(settings, image)
    await session.delete(image)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{image_id}/approval", summary="Bild freigeben")
async def approve(image_id: str, session: Session, user: Reviews) -> SubmissionOut:
    """Gibt ein Bild frei. Damit steht es oeffentlich an seiner Art."""
    image = await service.image_or_404(session, image_id)
    image.state = ImageState.APPROVED
    # Ein Grund an einem freigegebenen Bild waere eine Absage, die nicht gilt.
    image.reject_reason = None
    image.reviewed_by = user.sub
    image.reviewed_at = utc_now()
    await session.commit()
    await session.refresh(image)
    return await one_submission(session, image)


@router.post("/{image_id}/rejection", summary="Bild ablehnen")
async def reject(
    image_id: str,
    rejection: Rejection,
    session: Session,
    user: Reviews,
) -> SubmissionOut:
    """Lehnt ein Bild ab. Der Grund ist Pflicht und geht an die einreichende Person."""
    image = await service.image_or_404(session, image_id)
    image.state = ImageState.REJECTED
    image.reject_reason = rejection.reason
    # Ein abgelehntes Bild darf nicht als Titelbild stehen bleiben.
    image.lead = False
    image.reviewed_by = user.sub
    image.reviewed_at = utc_now()
    await session.commit()
    await session.refresh(image)
    return await one_submission(session, image)
