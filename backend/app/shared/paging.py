"""Blaettern durch eine Liste. Jede Liste des Dienstes nimmt diesen Weg."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Annotated, Final

from fastapi import Depends, Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.schemas import BasisModell

GRENZE_STANDARD: Final = 50
GRENZE_HOECHSTENS: Final = 200


@dataclass(frozen=True, slots=True)
class Blaettern:
    """Der Ausschnitt, den eine Anfrage sehen will."""

    limit: int
    offset: int


def blaettern(
    limit: Annotated[int, Query(ge=1, le=GRENZE_HOECHSTENS)] = GRENZE_STANDARD,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Blaettern:
    """Dependency: liest ``limit`` und ``offset`` aus der Abfrage."""
    return Blaettern(limit=limit, offset=offset)


Ausschnitt = Annotated[Blaettern, Depends(blaettern)]


class Seite[E](BasisModell):
    """Ein Ausschnitt einer Liste, mit der Gesamtzahl dahinter."""

    eintraege: list[E]
    gesamt: int
    limit: int
    offset: int


async def seite_laden[Z, E](
    sitzung: AsyncSession,
    auswahl: Select[tuple[Z]],
    wunsch: Blaettern,
    bauen: Callable[[Z], E],
) -> Seite[E]:
    """Zaehlt die Treffer einer Abfrage und liefert den gewuenschten Ausschnitt."""
    gezaehlt = await sitzung.execute(select(func.count()).select_from(auswahl.subquery()))
    treffer = await sitzung.scalars(auswahl.limit(wunsch.limit).offset(wunsch.offset))
    return Seite(
        eintraege=[bauen(zeile) for zeile in treffer],
        gesamt=int(gezaehlt.scalar_one()),
        limit=wunsch.limit,
        offset=wunsch.offset,
    )


def seite_aus[E](eintraege: Sequence[E], wunsch: Blaettern) -> Seite[E]:
    """Schneidet eine Liste zurecht, die schon im Speicher liegt."""
    return Seite(
        eintraege=list(eintraege[wunsch.offset : wunsch.offset + wunsch.limit]),
        gesamt=len(eintraege),
        limit=wunsch.limit,
        offset=wunsch.offset,
    )
