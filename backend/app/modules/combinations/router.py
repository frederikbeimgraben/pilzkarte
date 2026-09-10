"""Endpunkte der Kombinationen. Jede Route braucht ein Konto, eine fremde ist 404."""

from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, current_user
from app.core.db import db_session
from app.core.errors import Invalid
from app.core.settings import Settings, get_settings
from app.models import Combination
from app.modules.combinations.schemas import (
    CombinationIn,
    CombinationOut,
    CombinationPatch,
    Factor,
    combination_out,
    write_factors,
)
from app.modules.combinations.sources import layer_names
from app.modules.species.catalog import Catalog
from app.modules.species.router import current_catalog
from app.shared.objects import apply_patch, owned
from app.shared.paging import Page, Paging, load_page

router = APIRouter(prefix="/kombinationen", tags=["kombinationen"])

Authenticated = Annotated[User, Depends(current_user)]
Session = Annotated[AsyncSession, Depends(db_session)]


def known_sources(
    settings: Annotated[Settings, Depends(get_settings)],
    catalog: Annotated[Catalog, Depends(current_catalog)],
) -> frozenset[str]:
    """Alles, was ein Faktor nennen darf: Eingabe-Ebenen und Vorhersagekarten."""
    return layer_names(settings.maps) | frozenset(catalog.maps.values())


Sources = Annotated[frozenset[str], Depends(known_sources)]


def check_sources(known: frozenset[str], factors: Sequence[Factor]) -> None:
    """Weist eine Quelle ab, zu der es keine Wertkacheln gibt."""
    unknown = sorted({factor.source for factor in factors} - known)
    if unknown:
        raise Invalid(f"Diese Quellen gibt es nicht: {', '.join(unknown)}.")


def set_factors(
    combination: Combination,
    factors: Sequence[Factor],
    known: frozenset[str],
) -> None:
    """Prueft die Quellen und legt die Faktoren in der Textspalte ab."""
    check_sources(known, factors)
    combination.factors = write_factors(list(factors))


@router.get("", summary="Eigene Kombinationen")
async def combination_list(
    user: Authenticated,
    session: Session,
    paging: Paging,
) -> Page[CombinationOut]:
    """Liefert die eigenen Kombinationen, zuletzt geaenderte zuerst."""
    query = (
        select(Combination)
        .where(Combination.owner_sub == user.sub)
        .order_by(Combination.updated_at.desc())
    )
    return await load_page(session, query, paging, combination_out)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Kombination speichern")
async def create_combination(
    payload: CombinationIn,
    user: Authenticated,
    session: Session,
    sources: Sources,
) -> CombinationOut:
    """Legt eine Kombination an. Der Besitzer kommt aus dem Token."""
    combination = Combination(
        owner_sub=user.sub,
        **payload.model_dump(exclude={"factors"}),
    )
    set_factors(combination, payload.factors, sources)
    session.add(combination)
    await session.commit()
    await session.refresh(combination)
    return combination_out(combination)


@router.get("/{combination_id}", summary="Eine eigene Kombination")
async def read_combination(
    combination_id: str,
    user: Authenticated,
    session: Session,
) -> CombinationOut:
    """Liefert eine eigene Kombination."""
    return combination_out(await owned(session, Combination, combination_id, user))


@router.patch("/{combination_id}", summary="Kombination aendern")
async def patch_combination(
    combination_id: str,
    patch: CombinationPatch,
    user: Authenticated,
    session: Session,
    sources: Sources,
) -> CombinationOut:
    """Aendert die Felder, die in der Anfrage standen."""
    combination = await owned(session, Combination, combination_id, user)
    apply_patch(combination, patch, without={"factors"})
    if patch.factors is not None:
        set_factors(combination, patch.factors, sources)
    await session.commit()
    await session.refresh(combination)
    return combination_out(combination)


@router.delete(
    "/{combination_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Kombination loeschen",
)
async def delete_combination(
    combination_id: str,
    user: Authenticated,
    session: Session,
) -> Response:
    """Loescht eine eigene Kombination."""
    combination = await owned(session, Combination, combination_id, user)
    await session.delete(combination)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
