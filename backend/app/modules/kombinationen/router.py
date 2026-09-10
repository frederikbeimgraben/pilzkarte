"""Endpunkte der Kombinationen. Jede Route braucht ein Konto, eine fremde ist 404."""

from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Nutzer, aktueller_nutzer
from app.core.db import sitzung
from app.core.errors import Ungueltig
from app.core.settings import Einstellungen, einstellungen
from app.models import Kombination
from app.modules.arten.katalog import Katalog
from app.modules.arten.router import aktueller_katalog
from app.modules.kombinationen.quellen import ebenennamen
from app.modules.kombinationen.schemas import (
    Faktor,
    KombinationAenderung,
    KombinationAus,
    KombinationEingabe,
    faktoren_schreiben,
    kombination_aus,
)
from app.shared.objekte import eigenes, uebernehmen
from app.shared.paging import Ausschnitt, Seite, seite_laden

router = APIRouter(prefix="/kombinationen", tags=["kombinationen"])

Angemeldet = Annotated[Nutzer, Depends(aktueller_nutzer)]
Sitzung = Annotated[AsyncSession, Depends(sitzung)]


def bekannte_quellen(
    werte: Annotated[Einstellungen, Depends(einstellungen)],
    gewaehlt: Annotated[Katalog, Depends(aktueller_katalog)],
) -> frozenset[str]:
    """Alles, was ein Faktor nennen darf: Eingabe-Ebenen und Vorhersagekarten."""
    return ebenennamen(werte.maps) | frozenset(gewaehlt.karten.values())


Quellen = Annotated[frozenset[str], Depends(bekannte_quellen)]


def quellen_pruefen(bekannt: frozenset[str], faktoren: Sequence[Faktor]) -> None:
    """Weist eine Quelle ab, zu der es keine Wertkacheln gibt."""
    unbekannt = sorted({faktor.quelle for faktor in faktoren} - bekannt)
    if unbekannt:
        raise Ungueltig(f"Diese Quellen gibt es nicht: {', '.join(unbekannt)}.")


def faktoren_setzen(
    kombination: Kombination,
    faktoren: Sequence[Faktor],
    bekannt: frozenset[str],
) -> None:
    """Prueft die Quellen und legt die Faktoren in der Textspalte ab."""
    quellen_pruefen(bekannt, faktoren)
    kombination.faktoren = faktoren_schreiben(list(faktoren))


@router.get("", summary="Eigene Kombinationen")
async def kombinationen_liste(
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    ausschnitt: Ausschnitt,
) -> Seite[KombinationAus]:
    """Liefert die eigenen Kombinationen, zuletzt geaenderte zuerst."""
    auswahl = (
        select(Kombination)
        .where(Kombination.besitzer_sub == nutzer.sub)
        .order_by(Kombination.geaendert_am.desc())
    )
    return await seite_laden(sitzung_, auswahl, ausschnitt, kombination_aus)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Kombination speichern")
async def kombination_anlegen(
    eingabe: KombinationEingabe,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    quellen: Quellen,
) -> KombinationAus:
    """Legt eine Kombination an. Der Besitzer kommt aus dem Token."""
    kombination = Kombination(
        besitzer_sub=nutzer.sub,
        **eingabe.model_dump(exclude={"faktoren"}),
    )
    faktoren_setzen(kombination, eingabe.faktoren, quellen)
    sitzung_.add(kombination)
    await sitzung_.commit()
    await sitzung_.refresh(kombination)
    return kombination_aus(kombination)


@router.get("/{kombination_id}", summary="Eine eigene Kombination")
async def kombination_lesen(
    kombination_id: str,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
) -> KombinationAus:
    """Liefert eine eigene Kombination."""
    return kombination_aus(await eigenes(sitzung_, Kombination, kombination_id, nutzer))


@router.patch("/{kombination_id}", summary="Kombination aendern")
async def kombination_aendern(
    kombination_id: str,
    aenderung: KombinationAenderung,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
    quellen: Quellen,
) -> KombinationAus:
    """Aendert die Felder, die in der Anfrage standen."""
    kombination = await eigenes(sitzung_, Kombination, kombination_id, nutzer)
    uebernehmen(kombination, aenderung, ausser={"faktoren"})
    if aenderung.faktoren is not None:
        faktoren_setzen(kombination, aenderung.faktoren, quellen)
    await sitzung_.commit()
    await sitzung_.refresh(kombination)
    return kombination_aus(kombination)


@router.delete(
    "/{kombination_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Kombination loeschen",
)
async def kombination_loeschen(
    kombination_id: str,
    nutzer: Angemeldet,
    sitzung_: Sitzung,
) -> Response:
    """Loescht eine eigene Kombination."""
    kombination = await eigenes(sitzung_, Kombination, kombination_id, nutzer)
    await sitzung_.delete(kombination)
    await sitzung_.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
