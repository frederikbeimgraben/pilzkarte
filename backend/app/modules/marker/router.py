"""Endpunkte der Marker. Jede Route braucht ein Konto, ein fremder Marker ist 404."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, current_user
from app.core.db import db_session
from app.models import Marker
from app.modules.marker.schemas import MarkerIn, MarkerOut, MarkerPatch, marker_out
from app.shared.objects import apply_patch, owned
from app.shared.paging import Page, Paging, load_page

router = APIRouter(prefix="/marker", tags=["marker"])

Authenticated = Annotated[User, Depends(current_user)]
Session = Annotated[AsyncSession, Depends(db_session)]


@router.get("", summary="Eigene Marker")
async def marker_list(
    user: Authenticated,
    session: Session,
    paging: Paging,
) -> Page[MarkerOut]:
    """Liefert die eigenen Marker, zuletzt geaenderte zuerst."""
    query = select(Marker).where(Marker.owner_sub == user.sub).order_by(Marker.updated_at.desc())
    return await load_page(session, query, paging, marker_out)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Marker setzen")
async def create_marker(
    payload: MarkerIn,
    user: Authenticated,
    session: Session,
) -> MarkerOut:
    """Legt einen Marker an. Der Besitzer kommt aus dem Token."""
    marker = Marker(owner_sub=user.sub, **payload.model_dump())
    session.add(marker)
    await session.commit()
    await session.refresh(marker)
    return marker_out(marker)


@router.get("/{marker_id}", summary="Ein eigener Marker")
async def read_marker(marker_id: str, user: Authenticated, session: Session) -> MarkerOut:
    """Liefert einen eigenen Marker."""
    return marker_out(await owned(session, Marker, marker_id, user))


@router.patch("/{marker_id}", summary="Marker aendern")
async def patch_marker(
    marker_id: str,
    patch: MarkerPatch,
    user: Authenticated,
    session: Session,
) -> MarkerOut:
    """Aendert die Felder, die in der Anfrage standen."""
    marker = await owned(session, Marker, marker_id, user)
    apply_patch(marker, patch)
    await session.commit()
    await session.refresh(marker)
    return marker_out(marker)


@router.delete("/{marker_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Marker loeschen")
async def delete_marker(marker_id: str, user: Authenticated, session: Session) -> Response:
    """Loescht einen eigenen Marker."""
    marker = await owned(session, Marker, marker_id, user)
    await session.delete(marker)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
