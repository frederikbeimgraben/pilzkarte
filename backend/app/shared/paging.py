"""Blaettern durch eine Liste. Jede Liste des Dienstes nimmt diesen Weg."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Annotated, Final

from fastapi import Depends, Query
from pydantic import Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.schemas import BaseSchema

LIMIT_DEFAULT: Final = 50
LIMIT_MAX: Final = 200


@dataclass(frozen=True, slots=True)
class PageRequest:
    """Der Ausschnitt, den eine Anfrage sehen will."""

    limit: int
    offset: int


def paging_params(
    limit: Annotated[int, Query(ge=1, le=LIMIT_MAX)] = LIMIT_DEFAULT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PageRequest:
    """Dependency: liest ``limit`` und ``offset`` aus der Abfrage."""
    return PageRequest(limit=limit, offset=offset)


Paging = Annotated[PageRequest, Depends(paging_params)]


class Page[E](BaseSchema):
    """Ein Ausschnitt einer Liste, mit der Gesamtzahl dahinter."""

    entries: list[E] = Field(validation_alias="eintraege", serialization_alias="eintraege")
    total: int = Field(validation_alias="gesamt", serialization_alias="gesamt")
    limit: int
    offset: int


async def load_page[Z, E](
    db_session: AsyncSession,
    query: Select[tuple[Z]],
    paging: PageRequest,
    build: Callable[[Z], E],
) -> Page[E]:
    """Zaehlt die Treffer einer Abfrage und liefert den gewuenschten Ausschnitt."""
    counted = await db_session.execute(select(func.count()).select_from(query.subquery()))
    hit = await db_session.scalars(query.limit(paging.limit).offset(paging.offset))
    return Page(
        entries=[build(line) for line in hit],
        total=int(counted.scalar_one()),
        limit=paging.limit,
        offset=paging.offset,
    )


def page_of[E](entries: Sequence[E], paging: PageRequest) -> Page[E]:
    """Schneidet eine Liste zurecht, die schon im Speicher liegt."""
    return Page(
        entries=list(entries[paging.offset : paging.offset + paging.limit]),
        total=len(entries),
        limit=paging.limit,
        offset=paging.offset,
    )
