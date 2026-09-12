"""Endpunkt der Begriffskataloge. Offen, auch ohne Anmeldung."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import db_session
from app.models import Term as TermRow
from app.modules.terms.schemas import Term, TermCatalog, TermKind

router = APIRouter(prefix="/begriffe", tags=["begriffe"])

Session = Annotated[AsyncSession, Depends(db_session)]


async def read_terms(session: AsyncSession) -> dict[TermKind, list[Term]]:
    """Liest alle Begriffe, nach Katalog getrennt und in ihrer Reihenfolge."""
    rows = (
        await session.execute(
            select(TermRow).order_by(TermRow.kind, TermRow.position, TermRow.slug)
        )
    ).scalars()
    result: dict[TermKind, list[Term]] = {kind: [] for kind in TermKind}
    for row in rows:
        result[TermKind(row.kind)].append(Term(slug=row.slug, name=row.name))
    return result


@router.get("", summary="Geruch, Geschmack und Baumarten")
async def term_catalog(session: Session) -> TermCatalog:
    """Liefert die verwalteten Kataloge.

    Die Profile nennen nur Slugs. Das Frontend holt die Namen einmal hier und
    braucht danach keine Liste im Code.
    """
    terms = await read_terms(session)
    return TermCatalog(
        smell=terms[TermKind.SMELL], taste=terms[TermKind.TASTE], trees=terms[TermKind.TREE]
    )
