"""Endpunkte fuer die Texte der Oberflaeche.

Lesen darf jeder, auch ohne Konto: ohne die Texte gaebe es keine Oberflaeche.
Schreiben darf, wer das Recht ``text.edit`` traegt. Die Pruefung liegt im
Backend, das Frontend blendet den Punkt nur aus.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User
from app.core.db import db_session
from app.core.errors import NotFound
from app.models import UiText
from app.modules.access.guard import requires
from app.modules.access.permissions import Permission
from app.modules.texts.schemas import Catalogue, TextIn, TextOut
from app.modules.texts.seed import Locale, default_for
from app.modules.texts.service import one_text, revision, whole_catalogue

router = APIRouter(tags=["texte"])

Session = Annotated[AsyncSession, Depends(db_session)]
EditsTexts = Annotated[User, Depends(requires(Permission.TEXT_EDIT))]
LocaleQuery = Annotated[Locale, Query(description="Die Sprache des Textes")]
NoneMatch = Annotated[str | None, Header(alias="If-None-Match")]


async def row_or_404(session: AsyncSession, key: str, locale: Locale) -> UiText:
    """Liest eine Zeile. Ein Schluessel, den der Katalog nicht kennt, ist ein 404."""
    row = await session.scalar(
        select(UiText).where(UiText.key == key, UiText.locale == locale.value),
    )
    if row is None:
        raise NotFound(f"Den Textschlüssel {key} gibt es nicht.")
    return row


@router.get("/texts", response_model=Catalogue, summary="Alle Texte der Oberfläche")
async def text_catalogue(
    session: Session,
    response: Response,
    if_none_match: NoneMatch = None,
) -> Catalogue | Response:
    """Liefert jeden Schlüssel mit seinen Sprachen.

    Der Katalog ist gross und ändert sich selten. ``no-cache`` heisst nicht
    "nicht ablegen", sondern "vor dem Benutzen nachfragen": der Browser hält
    die Antwort und schickt bei jedem Start nur noch den ETag. Ein geänderter
    Text ist damit sofort da, ein unveränderter Katalog kostet nichts.
    """
    tag = await revision(session)
    headers = {"ETag": tag, "Cache-Control": "no-cache"}
    if if_none_match == tag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    response.headers.update(headers)
    return await whole_catalogue(session, tag)


@router.put("/texts/{key}", summary="Einen Text ändern")
async def change_text(key: str, payload: TextIn, session: Session, user: EditsTexts) -> TextOut:
    """Setzt einen Text in einer Sprache. Der Schlüssel selbst bleibt, wie er ist."""
    row = await row_or_404(session, key, payload.locale)
    row.value = payload.value
    row.updated_by = user.sub
    await session.commit()
    return await one_text(session, key)


@router.delete("/texts/{key}", summary="Einen Text auf die Vorgabe zurücksetzen")
async def reset_text(
    key: str,
    session: Session,
    _: EditsTexts,
    locale: LocaleQuery = Locale.DE,
) -> TextOut:
    """Holt die Vorgabe aus ``daten/texte.json`` zurück."""
    row = await row_or_404(session, key, locale)
    default = default_for(key, locale)
    if default is None:
        raise NotFound(f"Für {key} gibt es keine Vorgabe mehr.")
    row.value = default
    row.updated_by = None
    await session.commit()
    return await one_text(session, key)
