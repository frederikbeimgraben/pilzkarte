"""Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.settings import Settings, get_settings
from app.modules.species.catalog import DATA, Catalog, catalog
from app.modules.species.schemas import Species, SpeciesList

router = APIRouter(prefix="/arten", tags=["arten"])


def current_catalog(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Catalog:
    """Liefert den Katalog des Prozesses. Tests haengen hier ihren eigenen ein."""
    return catalog(DATA, settings.maps)


@router.get("", summary="Alle sammelbaren Arten")
async def species_list(
    catalog: Annotated[Catalog, Depends(current_catalog)],
) -> SpeciesList:
    """Liefert jede Art mit Stufe, Tags und der Saisonkurve aller Jahre."""
    return catalog.listing()


@router.get("/{slug}", summary="Profil einer Art")
async def species_profile(
    slug: str,
    catalog: Annotated[Catalog, Depends(current_catalog)],
) -> Species:
    """Liefert Merkmalstabelle, Verwechslungen, Links und beide Saisonreihen."""
    return catalog.species(slug)
