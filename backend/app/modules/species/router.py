"""Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.settings import Settings, get_settings
from app.modules.species.catalog import DATA, Catalog, catalog
from app.modules.species.schemas import Species, SpeciesList

router = APIRouter(prefix="/arten", tags=["arten"])


def current_catalog(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Catalog:
    """Liefert den Katalog des Prozesses. Tests haengen hier ihren eigenen ein."""
    return catalog(DATA, settings.maps)


@router.get("", summary="Die sammelbaren Arten")
async def species_list(
    catalog: Annotated[Catalog, Depends(current_catalog)],
    *,
    # Die Namen auf dem Draht bleiben deutsch, bis R3 den Vertrag umstellt.
    collectable: Annotated[
        bool,
        Query(
            alias="sammelbar",
            description="true liefert die sammelbaren Arten, false die Verwechslungsarten.",
        ),
    ] = True,
    all_groups: Annotated[
        bool,
        Query(alias="alle", description="Liefert beide Gruppen zusammen und schlaegt sammelbar."),
    ] = False,
) -> SpeciesList:
    """Liefert die Arten mit Stufe, Tags und der Saisonkurve aller Jahre.

    Ohne Parameter kommen nur die sammelbaren Arten. Die Verwechslungsarten
    gehoeren nicht in denselben Reiter wie die Speisepilze.
    """
    return catalog.listing(only_collectable=None if all_groups else collectable)


@router.get("/{slug}", summary="Profil einer Art")
async def species_profile(
    slug: str,
    catalog: Annotated[Catalog, Depends(current_catalog)],
) -> Species:
    """Liefert Merkmalstabelle, Verwechslungen, Links und beide Saisonreihen."""
    return catalog.species(slug)
