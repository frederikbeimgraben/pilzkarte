"""Endpunkte der Einordnung. Beide sind offen, auch ohne Anmeldung."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import db_session
from app.modules.species.catalog import Catalog
from app.modules.species.dependencies import current_catalog
from app.modules.taxonomy.schemas import TaxonPage
from app.modules.taxonomy.service import taxon_page
from app.shared.schemas import TaxonRank

router = APIRouter(prefix="/taxonomie", tags=["taxonomie"])

Session = Annotated[AsyncSession, Depends(db_session)]
CurrentCatalog = Annotated[Catalog, Depends(current_catalog)]


@router.get("/{rank}/{slug}", summary="Eine Stufe der Einordnung")
async def taxon_detail(
    rank: TaxonRank, slug: str, session: Session, catalog: CurrentCatalog
) -> TaxonPage:
    """Liefert Pfad und Geschwister nach aussen, Kinder und Arten nach innen."""
    return await taxon_page(session, catalog, rank, slug)
