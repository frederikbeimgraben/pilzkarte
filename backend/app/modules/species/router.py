"""Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.settings import Settings, get_settings
from app.modules.species.catalog import DATA, Catalog, SpeciesFilter, catalog
from app.modules.species.schemas import Species, SpeciesList, SpeciesQuery

router = APIRouter(prefix="/arten", tags=["arten"])


def current_catalog(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Catalog:
    """Liefert den Katalog des Prozesses. Tests haengen hier ihren eigenen ein."""
    return catalog(DATA, settings.maps)


@router.get("", summary="Die sammelbaren Arten")
async def species_list(
    catalog: Annotated[Catalog, Depends(current_catalog)],
    # Die Namen auf dem Draht bleiben deutsch, bis R3 den Vertrag umstellt.
    chosen: Annotated[SpeciesQuery, Query()],
) -> SpeciesList:
    """Liefert die Arten mit Stufe, Tags und der Saisonkurve aller Jahre.

    Ohne Parameter kommen nur die sammelbaren Arten. Die Verwechslungsarten
    gehoeren nicht in denselben Reiter wie die Speisepilze.

    Jedes strukturierte Feld ist eine Bedingung. Sie gelten zusammen, und was
    leer bleibt, schraenkt nicht ein.
    """
    return catalog.listing(
        only_collectable=None if chosen.all_groups else chosen.collectable,
        chosen=SpeciesFilter(
            group=chosen.group,
            tier=chosen.tier,
            edibility=chosen.edibility,
            protection=chosen.protection,
            frequency=chosen.frequency,
            red_list=chosen.red_list,
            rating=chosen.rating,
            marketable=chosen.marketable,
            smell=chosen.smell,
            taste=chosen.taste,
            tree=chosen.tree,
            month=chosen.month,
            colour=chosen.colour,
        ),
    )


@router.get("/{slug}", summary="Profil einer Art")
async def species_profile(
    slug: str,
    catalog: Annotated[Catalog, Depends(current_catalog)],
) -> Species:
    """Liefert Merkmalstabelle, Verwechslungen, Links und beide Saisonreihen."""
    return catalog.species(slug)
