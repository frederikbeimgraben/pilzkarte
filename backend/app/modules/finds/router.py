"""Endpunkte der Funde, ihrer Fotos und der geteilten Karte.

Jede Route hier braucht ein Konto. Der Besitzer ist der ``sub`` aus dem Token.
Ein fremder Fund endet mit 404 und nicht mit 403.
"""

import shutil
from pathlib import Path
from typing import Annotated, Final

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, current_user, optional_user
from app.core.db import db_session
from app.core.errors import Conflict, Invalid, NotFound, UnsupportedMediaType
from app.core.settings import Settings, get_settings
from app.models import Find, Photo, new_identifier
from app.modules.finds.schemas import (
    FindIn,
    FindOut,
    FindPatch,
    PhotoOut,
    SharedFind,
    find_out,
    photo_out,
    shared_find_out,
)
from app.modules.species.catalog import Catalog
from app.modules.species.dependencies import current_catalog
from app.shared import images
from app.shared.geometry import (
    GRID_KM,
    KM_PER_LAT_DEGREE,
    Box,
    Point,
    grow_box,
    in_box,
    read_box,
    to_grid,
)
from app.shared.objects import apply_patch, owned
from app.shared.paging import Page, Paging, load_page, page_of
from app.shared.schemas import Visibility

router = APIRouter(prefix="/funde", tags=["funde"])

# Weiter als eine halbe Masche kann das Runden einen Punkt nicht verschieben.
GRID_MARGIN_DEG: Final = GRID_KM / KM_PER_LAT_DEGREE

PHOTOS_PER_FIND: Final = 3

Authenticated = Annotated[User, Depends(current_user)]
# Die Karte mit geteilten Funden liest man auch ohne Konto. Ein Konto braucht
# nur, wer speichert. Ein falsches Token bleibt auch hier ein Fehler.
MaybeUser = Annotated[User | None, Depends(optional_user)]
Session = Annotated[AsyncSession, Depends(db_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
CatalogDep = Annotated[Catalog, Depends(current_catalog)]


def check_species(catalog: Catalog, slug: str) -> None:
    """Weist einen Slug ab, den der Artenkatalog nicht kennt."""
    if not catalog.has(slug):
        raise Invalid(f"Die Art {slug} steht nicht im Katalog.")


def read_bbox(bbox: str | None) -> Box | None:
    """Liest den bbox-Parameter, falls einer dabei ist."""
    if bbox is None:
        return None
    try:
        return read_box(bbox)
    except ValueError as error:
        raise Invalid(str(error)) from error


def photo_folder(settings: Settings, find_id: str) -> Path:
    """Der Ordner, in dem die Fotos eines Fundes liegen."""
    return settings.photos / find_id


def own_finds(user: User) -> Select[tuple[Find]]:
    """Die eigenen Funde, neueste zuerst."""
    return (
        select(Find)
        .where(Find.owner_sub == user.sub)
        .order_by(Find.found_on.desc(), Find.created_at.desc())
    )


async def readable_find(session: AsyncSession, identifier: str, user: User) -> Find:
    """Liest einen Fund, den diese Person sehen darf: den eigenen oder einen geteilten."""
    hit = await session.get(Find, identifier)
    if hit is None:
        raise NotFound("Diesen Fund gibt es nicht.")
    if hit.owner_sub != user.sub and hit.visibility is not Visibility.SHARED:
        raise NotFound("Diesen Fund gibt es nicht.")
    return hit


async def photo_of_find(session: AsyncSession, find: Find, photo_id: str) -> Photo:
    """Liest ein Foto, das an diesem Fund haengt."""
    hit = await session.get(Photo, photo_id)
    if hit is None or hit.find_id != find.id:
        raise NotFound("Dieses Foto gibt es nicht.")
    return hit


def place_for(find: Find, catalog: Catalog, sub: str | None) -> tuple[Point, bool]:
    """Der Ort, der einen geteilten Fund verlassen darf, und ob er grob ist.

    Der eigene Fund bleibt immer genau. Bei einer geschuetzten Art liegt ein
    fremder Fund auf dem Raster, nie auf seinem Punkt. Ein Zugang ohne Konto hat
    keinen ``sub`` und besitzt darum keinen Fund.
    """
    exact: Point = (find.lon, find.lat)
    if find.owner_sub == sub:
        return exact, False
    if catalog.is_protected(find.species_slug):
        return to_grid(exact, GRID_KM), True
    return exact, False


@router.get("", summary="Eigene Funde")
async def find_list(
    user: Authenticated,
    session: Session,
    paging: Paging,
) -> Page[FindOut]:
    """Liefert die eigenen Funde, neueste zuerst."""
    return await load_page(session, own_finds(user), paging, find_out)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Fund melden")
async def create_find(
    payload: FindIn,
    user: Authenticated,
    session: Session,
    catalog: CatalogDep,
) -> FindOut:
    """Legt einen Fund an. Besitzer und Anzeigename kommen aus dem Token."""
    check_species(catalog, payload.species_slug)
    find = Find(
        owner_sub=user.sub,
        owner_name=user.name,
        **payload.model_dump(),
    )
    session.add(find)
    await session.commit()
    await session.refresh(find)
    return find_out(find)


@router.get("/geteilt", summary="Geteilte Funde im Ausschnitt, auch ohne Konto")
async def shared_finds(
    user: MaybeUser,
    session: Session,
    catalog: CatalogDep,
    paging: Paging,
    bbox: Annotated[str | None, Query(description="west,sueden,osten,norden in Grad")] = None,
) -> Page[SharedFind]:
    """Liefert geteilte Funde. Geschuetzte Arten liegen auf einem 5-km-Raster.

    Diese Route liest auch, wer nicht angemeldet ist. Dann gehoert kein Fund dem
    Aufrufer: jeder Eintrag traegt ``eigen: false``, und jede geschuetzte Art
    liegt auf dem Raster.

    Gesucht wird in einem etwas groesseren Rechteck als gefragt, und gefiltert
    wird erst nach dem Runden. Sonst liesse sich der genaue Ort einer
    geschuetzten Art aus der Grenze des Ausschnitts zurueckrechnen.
    """
    sub = user.sub if user is not None else None
    box = read_bbox(bbox)
    query = (
        select(Find)
        .where(Find.visibility == Visibility.SHARED)
        .order_by(Find.found_on.desc(), Find.created_at.desc())
    )
    if box is not None:
        west, south, east, north = grow_box(box, GRID_MARGIN_DEG)
        query = query.where(
            Find.lon >= west,
            Find.lon <= east,
            Find.lat >= south,
            Find.lat <= north,
        )
    hit = await session.scalars(query)

    visible: list[SharedFind] = []
    for find in hit:
        place, rounded = place_for(find, catalog, sub)
        if box is not None and not in_box(place, box):
            continue
        visible.append(
            shared_find_out(
                find,
                place,
                rounded=rounded,
                own=find.owner_sub == sub,
            )
        )
    return page_of(visible, paging)


@router.get("/{find_id}", summary="Ein eigener Fund")
async def read_find(find_id: str, user: Authenticated, session: Session) -> FindOut:
    """Liefert einen eigenen Fund mit genauem Ort und seinen Fotos."""
    return find_out(await owned(session, Find, find_id, user))


@router.patch("/{find_id}", summary="Fund aendern")
async def patch_find(
    find_id: str,
    patch: FindPatch,
    user: Authenticated,
    session: Session,
    catalog: CatalogDep,
) -> FindOut:
    """Aendert die Felder, die in der Anfrage standen."""
    find = await owned(session, Find, find_id, user)
    if patch.species_slug is not None:
        check_species(catalog, patch.species_slug)
    apply_patch(find, patch)
    await session.commit()
    await session.refresh(find)
    return find_out(find)


@router.delete("/{find_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Fund loeschen")
async def delete_find(
    find_id: str,
    user: Authenticated,
    session: Session,
    settings: SettingsDep,
) -> Response:
    """Loescht einen Fund mit seinen Fotos, in der Datenbank und auf der Platte."""
    find = await owned(session, Find, find_id, user)
    await session.delete(find)
    await session.commit()
    shutil.rmtree(photo_folder(settings, find_id), ignore_errors=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{find_id}/fotos",
    status_code=status.HTTP_201_CREATED,
    summary="Foto an einen Fund haengen",
)
async def create_photo(
    find_id: str,
    user: Authenticated,
    session: Session,
    settings: SettingsDep,
    file: Annotated[UploadFile, File(alias="datei", description="JPEG oder WebP")],
) -> PhotoOut:
    """Nimmt ein Bild an, verkleinert es und legt es ohne EXIF als JPEG ab."""
    find = await owned(session, Find, find_id, user)
    if len(find.photos) >= PHOTOS_PER_FIND:
        raise Conflict(f"An einem Fund haengen hoechstens {PHOTOS_PER_FIND} Fotos.")
    if file.content_type not in images.MEDIA_TYPES:
        raise UnsupportedMediaType("Der Dienst nimmt nur JPEG und WebP an.")

    data, width, height = images.shrink(await file.read())
    # Die Kennung faellt hier und nicht erst beim Schreiben, weil sie den
    # Dateinamen traegt.
    identifier = new_identifier()
    photo = Photo(
        id=identifier,
        find_id=find.id,
        filename=f"{identifier}{images.SUFFIX}",
        width=width,
        height=height,
    )
    _ = images.store(photo_folder(settings, find.id), photo.filename, data)
    session.add(photo)
    await session.commit()
    await session.refresh(photo)
    return photo_out(photo)


@router.get("/{find_id}/fotos/{photo_id}", summary="Foto ausliefern")
async def read_photo(
    find_id: str,
    photo_id: str,
    user: Authenticated,
    session: Session,
    settings: SettingsDep,
) -> FileResponse:
    """Liefert die Bilddatei. Nur der Besitzer oder ein geteilter Fund geben sie her."""
    find = await readable_find(session, find_id, user)
    photo = await photo_of_find(session, find, photo_id)
    return FileResponse(photo_folder(settings, find.id) / photo.filename, media_type="image/jpeg")


@router.delete(
    "/{find_id}/fotos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Foto loeschen",
)
async def delete_photo(
    find_id: str,
    photo_id: str,
    user: Authenticated,
    session: Session,
    settings: SettingsDep,
) -> Response:
    """Loescht ein Foto des eigenen Fundes."""
    find = await owned(session, Find, find_id, user)
    photo = await photo_of_find(session, find, photo_id)
    images.remove(photo_folder(settings, find.id) / photo.filename)
    await session.delete(photo)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
