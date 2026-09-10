"""Endpunkte der Zonen. Jede Route braucht ein Konto, eine fremde Zone ist 404."""

from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, current_user
from app.core.db import db_session
from app.core.errors import NotFound
from app.core.settings import Settings, get_settings
from app.models import Find, Zone
from app.modules.species.catalog import Catalog
from app.modules.species.router import current_catalog
from app.modules.zones.schemas import (
    ZoneIn,
    ZoneOut,
    ZonePatch,
    ZoneValue,
    zone_out,
)
from app.modules.zones.tiles import (
    Manifest,
    area_mean,
    find_week,
    read_manifest,
)
from app.shared.geometry import area_ha, point_in_polygon
from app.shared.objects import apply_patch, owned
from app.shared.paging import Page, Paging, load_page
from app.shared.schemas import GeoPolygon, Week

router = APIRouter(prefix="/zonen", tags=["zonen"])

Authenticated = Annotated[User, Depends(current_user)]
Session = Annotated[AsyncSession, Depends(db_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
CatalogDep = Annotated[Catalog, Depends(current_catalog)]


def set_area(zone: Zone, polygon: GeoPolygon) -> None:
    """Legt Polygon und Flaeche gemeinsam ab. Die Flaeche rechnet der Dienst."""
    zone.polygon = polygon.model_dump_json()
    zone.area_ha = round(area_ha(polygon.ring), 2)


@router.get("", summary="Eigene Zonen")
async def zone_list(
    user: Authenticated,
    session: Session,
    paging: Paging,
) -> Page[ZoneOut]:
    """Liefert die eigenen Zonen, zuletzt geaenderte zuerst."""
    query = select(Zone).where(Zone.owner_sub == user.sub).order_by(Zone.updated_at.desc())
    return await load_page(session, query, paging, zone_out)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Zone zeichnen")
async def create_zone(
    payload: ZoneIn,
    user: Authenticated,
    session: Session,
) -> ZoneOut:
    """Legt eine Zone an. Der Besitzer kommt aus dem Token."""
    zone = Zone(owner_sub=user.sub, **payload.model_dump(exclude={"polygon"}))
    set_area(zone, payload.polygon)
    session.add(zone)
    await session.commit()
    await session.refresh(zone)
    return zone_out(zone)


@router.get("/{zone_id}", summary="Eine eigene Zone")
async def read_zone(zone_id: str, user: Authenticated, session: Session) -> ZoneOut:
    """Liefert eine eigene Zone."""
    return zone_out(await owned(session, Zone, zone_id, user))


@router.patch("/{zone_id}", summary="Zone aendern")
async def patch_zone(
    zone_id: str,
    patch: ZonePatch,
    user: Authenticated,
    session: Session,
) -> ZoneOut:
    """Aendert die Felder, die in der Anfrage standen. Neue Eckpunkte, neue Flaeche."""
    zone = await owned(session, Zone, zone_id, user)
    apply_patch(zone, patch, without={"polygon"})
    if patch.polygon is not None:
        set_area(zone, patch.polygon)
    await session.commit()
    await session.refresh(zone)
    return zone_out(zone)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Zone loeschen")
async def delete_zone(zone_id: str, user: Authenticated, session: Session) -> Response:
    """Loescht eine eigene Zone."""
    zone = await owned(session, Zone, zone_id, user)
    await session.delete(zone)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@dataclass(frozen=True, slots=True)
class MapWeek:
    """Die Wertkarte einer Art in einer Woche, aus dem Manifest aufgeloest."""

    species: str
    week: Week
    manifest: Manifest
    tile_path: str
    maps: Path


def map_week(
    settings: SettingsDep,
    catalog: CatalogDep,
    # Die Namen auf dem Draht bleiben deutsch, bis R3 den Vertrag umstellt.
    species: Annotated[str, Query(alias="art", description="Slug der Art aus dem Katalog")],
    year: Annotated[int, Query(alias="jahr", ge=2015, le=2100)],
    week: Annotated[int, Query(alias="woche", ge=1, le=53)],
) -> MapWeek:
    """Dependency: sucht Manifest und Woche der gefragten Art unter PILZE_MAPS."""
    profile = catalog.species(species)
    if profile.map_slug is None:
        raise NotFound(f"Fuer {species} gibt es keine Vorhersagekarte.")
    manifest = read_manifest(settings.maps, profile.map_slug)
    entry = find_week(manifest, year, week)
    return MapWeek(
        species=species,
        week=Week(year=year, week=week),
        manifest=manifest,
        tile_path=entry.tiles,
        maps=settings.maps,
    )


@router.get("/{zone_id}/wert", summary="Vorhersage in der Zone")
async def zone_value(
    zone_id: str,
    user: Authenticated,
    session: Session,
    map_name: Annotated[MapWeek, Depends(map_week)],
) -> ZoneValue:
    """Mittelt die Vorhersage ueber die Flaeche und zaehlt die eigenen Funde darin.

    Der Mittelwert gilt fuer genau diese Art und diese Woche, in Prozent je
    Begehung. Die Funde zaehlen alle Arten und alle Jahre.
    """
    zone = await owned(session, Zone, zone_id, user)
    ring = GeoPolygon.model_validate_json(zone.polygon).ring
    mean, points = area_mean(map_name.maps, map_name.manifest, map_name.tile_path, ring)

    finds = await session.scalars(select(Find).where(Find.owner_sub == user.sub))
    own_count = sum(1 for find in finds if point_in_polygon((find.lon, find.lat), ring))

    return ZoneValue(
        species=map_name.species,
        week=map_name.week,
        area_mean=round(mean, 1),
        points=points,
        own_finds=own_count,
    )
