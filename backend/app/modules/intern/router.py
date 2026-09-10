"""Der Weg von der App in die Kette.

Wer einen Fund fuer das Training freigibt, gibt seinen genauen Ort weiter. Die
Kette braucht ihn so: ein auf 5 km gerundeter Punkt liegt in der falschen
Wetterzelle und im falschen Kilometerquadrat.

Darum verlaesst diese Liste den Rechner nicht. Sie haengt an keinem Konto und
antwortet nur einer Anfrage vom Rechner selbst.
"""

from datetime import date
from typing import Annotated, Final

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import sitzung
from app.core.errors import NichtGefunden
from app.models import Fund
from app.modules.arten.katalog import Katalog
from app.modules.arten.router import aktueller_katalog
from app.shared.schemas import BasisModell

router = APIRouter(prefix="/intern", tags=["intern"])

# Der Rechner selbst, in beiden Schreibweisen. IPv6 nennt eine IPv4-Adresse
# auch in der eingebetteten Form.
LOKAL: Final = frozenset({"127.0.0.1", "::1", "::ffff:127.0.0.1"})

# Kopfzeilen, die ein Proxy setzt. Caddy schickt sie fuer den Vhost, und
# uvicorn schreibt mit --proxy-headers die Adresse daraus in request.client.
# Eine Anfrage ueber den Vhost saehe damit aus wie eine vom Rechner selbst.
WEITERGELEITET: Final = ("x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "forwarded")

# Ein 404 statt 403: von aussen gibt es diesen Pfad nicht, und die Antwort
# verraet nicht, dass es ihn gibt.
UNBEKANNT: Final = "Diesen Pfad gibt es nicht."


def nur_vom_rechner(request: Request) -> None:
    """Laesst nur eine Anfrage durch, die direkt am Port ankommt.

    Zweierlei muss stimmen: es darf keine Weiterleitungs-Kopfzeile geben, und
    die Adresse muss die des Rechners sein. Die erste Pruefung schliesst den
    Weg ueber Caddy aus, auch wenn jemand ``X-Forwarded-For: 127.0.0.1``
    faelscht. Die zweite schliesst einen zweiten Proxy aus, der keine
    Kopfzeile setzt.
    """
    if any(kopf in request.headers for kopf in WEITERGELEITET):
        raise NichtGefunden(UNBEKANNT)
    if request.client is None or request.client.host not in LOKAL:
        raise NichtGefunden(UNBEKANNT)


class TrainingsFund(BasisModell):
    """Ein freigegebener Fund, so wie die Kette ihn braucht.

    ``lateinisch`` ist der Name, unter dem die Art in GBIF steht. Nur er passt
    zu den Beobachtungen, mit denen das Modell rechnet. ``lat`` und ``lon``
    sind der gesetzte Punkt, nicht gerundet.
    """

    id: str
    art_slug: str
    lateinisch: str
    lat: float
    lon: float
    datum: date
    anzahl: int | None


@router.get(
    "/training-funde",
    dependencies=[Depends(nur_vom_rechner)],
    summary="Freigegebene Funde fuer die Kette",
)
async def training_funde(
    sitzung_: Annotated[AsyncSession, Depends(sitzung)],
    gewaehlt: Annotated[Katalog, Depends(aktueller_katalog)],
) -> list[TrainingsFund]:
    """Liefert jeden Fund, den sein Besitzer fuer das Training freigegeben hat.

    Ein Fund, dessen Art nicht mehr im Katalog steht, faellt heraus. Die Kette
    koennte ihn keiner Beobachtung zuordnen.
    """
    auswahl = select(Fund).where(Fund.fuer_training).order_by(Fund.datum, Fund.id)
    treffer = await sitzung_.scalars(auswahl)
    freigegeben: list[TrainingsFund] = []
    for fund in treffer:
        lateinisch = gewaehlt.lateinisch(fund.art_slug)
        if lateinisch is None:
            continue
        freigegeben.append(
            TrainingsFund(
                id=fund.id,
                art_slug=fund.art_slug,
                lateinisch=lateinisch,
                lat=fund.lat,
                lon=fund.lon,
                datum=fund.datum,
                anzahl=fund.anzahl,
            )
        )
    return freigegeben
