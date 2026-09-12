"""Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import db_session
from app.modules.species.catalog import Catalog, SpeciesFilter
from app.modules.species.dependencies import current_catalog
from app.modules.species.schemas import Species, SpeciesList, SpeciesQuery
from app.modules.taxonomy.service import lineage_of

router = APIRouter(prefix="/arten", tags=["arten"])


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
            hymenophore=chosen.hymenophore,
            attachment=chosen.attachment,
            spacing=chosen.spacing,
            edge=chosen.edge,
            cap_shape=chosen.cap_shape,
            cap_feature=chosen.cap_feature,
            cap_margin=chosen.cap_margin,
            stem_feature=chosen.stem_feature,
        ),
    )


@router.get("/{slug}", summary="Profil einer Art")
async def species_profile(
    slug: str,
    catalog: Annotated[Catalog, Depends(current_catalog)],
    session: Annotated[AsyncSession, Depends(db_session)],
) -> Species:
    """Liefert Merkmalstabelle, Verwechslungen, Links, Einordnung und beide Saisonreihen."""
    return catalog.species(slug, taxonomy=await lineage_of(session, catalog.scientific(slug)))
