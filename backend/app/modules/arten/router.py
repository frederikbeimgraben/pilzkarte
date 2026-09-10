"""Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.settings import Einstellungen, einstellungen
from app.modules.arten.katalog import DATEN, Katalog, katalog
from app.modules.arten.schemas import Art, ArtenListe

router = APIRouter(prefix="/arten", tags=["arten"])


def aktueller_katalog(
    werte: Annotated[Einstellungen, Depends(einstellungen)],
) -> Katalog:
    """Liefert den Katalog des Prozesses. Tests haengen hier ihren eigenen ein."""
    return katalog(DATEN, werte.maps)


@router.get("", summary="Die sammelbaren Arten")
async def arten_liste(
    gewaehlt: Annotated[Katalog, Depends(aktueller_katalog)],
    *,
    sammelbar: Annotated[
        bool,
        Query(description="true liefert die sammelbaren Arten, false die Verwechslungsarten."),
    ] = True,
    alle: Annotated[
        bool,
        Query(description="Liefert beide Gruppen zusammen und schlaegt sammelbar."),
    ] = False,
) -> ArtenListe:
    """Liefert die Arten mit Stufe, Tags und der Saisonkurve aller Jahre.

    Ohne Parameter kommen nur die sammelbaren Arten. Die Verwechslungsarten
    gehoeren nicht in denselben Reiter wie die Speisepilze.
    """
    return gewaehlt.liste(nur_sammelbare=None if alle else sammelbar)


@router.get("/{slug}", summary="Profil einer Art")
async def art_profil(
    slug: str,
    gewaehlt: Annotated[Katalog, Depends(aktueller_katalog)],
) -> Art:
    """Liefert Merkmalstabelle, Verwechslungen, Links und beide Saisonreihen."""
    return gewaehlt.art(slug)
