"""Endpunkte der Marker. Jede Route braucht ein Konto, ein fremder Marker ist 404."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Nutzer, aktueller_nutzer
from app.core.db import sitzung
from app.models import Marker
from app.modules.marker.schemas import MarkerAenderung, MarkerAus, MarkerEingabe, marker_aus
from app.shared.objekte import eigenes, uebernehmen
from app.shared.paging import Ausschnitt, Seite, seite_laden

router = APIRouter(prefix="/marker", tags=["marker"])

Angemeldet = Annotated[Nutzer, Depends(aktueller_nutzer)]
Sitzung = Annotated[AsyncSession, Depends(sitzung)]


@router.get("", summary="Eigene Marker")
async def marker_liste(
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    ausschnitt: Ausschnitt,
) -> Seite[MarkerAus]:
    """Liefert die eigenen Marker, zuletzt geaenderte zuerst."""
    auswahl = (
        select(Marker).where(Marker.besitzer_sub == nutzer.sub).order_by(Marker.geaendert_am.desc())
    )
    return await seite_laden(sitzung_, auswahl, ausschnitt, marker_aus)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Marker setzen")
async def marker_anlegen(
    eingabe: MarkerEingabe,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
) -> MarkerAus:
    """Legt einen Marker an. Der Besitzer kommt aus dem Token."""
    marker = Marker(besitzer_sub=nutzer.sub, **eingabe.model_dump())
    sitzung_.add(marker)
    await sitzung_.commit()
    await sitzung_.refresh(marker)
    return marker_aus(marker)


@router.get("/{marker_id}", summary="Ein eigener Marker")
async def marker_lesen(marker_id: str, nutzer: Angemeldet, sitzung_: Sitzung) -> MarkerAus:
    """Liefert einen eigenen Marker."""
    return marker_aus(await eigenes(sitzung_, Marker, marker_id, nutzer))


@router.patch("/{marker_id}", summary="Marker aendern")
async def marker_aendern(
    marker_id: str,
    aenderung: MarkerAenderung,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
) -> MarkerAus:
    """Aendert die Felder, die in der Anfrage standen."""
    marker = await eigenes(sitzung_, Marker, marker_id, nutzer)
    uebernehmen(marker, aenderung)
    await sitzung_.commit()
    await sitzung_.refresh(marker)
    return marker_aus(marker)


@router.delete("/{marker_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Marker loeschen")
async def marker_loeschen(marker_id: str, nutzer: Angemeldet, sitzung_: Sitzung) -> Response:
    """Loescht einen eigenen Marker."""
    marker = await eigenes(sitzung_, Marker, marker_id, nutzer)
    await sitzung_.delete(marker)
    await sitzung_.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
