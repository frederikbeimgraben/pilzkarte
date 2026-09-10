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
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import db_session
from app.core.errors import NotFound
from app.models import Find
from app.modules.species.catalog import Catalog
from app.modules.species.router import current_catalog
from app.shared.schemas import BaseSchema

router = APIRouter(prefix="/intern", tags=["intern"])

# Der Rechner selbst, in beiden Schreibweisen. IPv6 nennt eine IPv4-Adresse
# auch in der eingebetteten Form.
LOCAL: Final = frozenset({"127.0.0.1", "::1", "::ffff:127.0.0.1"})

# Kopfzeilen, die ein Proxy setzt. Caddy schickt sie fuer den Vhost, und
# uvicorn schreibt mit --proxy-headers die Adresse daraus in request.client.
# Eine Anfrage ueber den Vhost saehe damit aus wie eine vom Rechner selbst.
FORWARDED_HEADERS: Final = ("x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "forwarded")

# Ein 404 statt 403: von aussen gibt es diesen Pfad nicht, und die Antwort
# verraet nicht, dass es ihn gibt.
UNKNOWN: Final = "Diesen Pfad gibt es nicht."


def only_from_host(request: Request) -> None:
    """Laesst nur eine Anfrage durch, die direkt am Port ankommt.

    Zweierlei muss stimmen: es darf keine Weiterleitungs-Kopfzeile geben, und
    die Adresse muss die des Rechners sein. Die erste Pruefung schliesst den
    Weg ueber Caddy aus, auch wenn jemand ``X-Forwarded-For: 127.0.0.1``
    faelscht. Die zweite schliesst einen zweiten Proxy aus, der keine
    Kopfzeile setzt.
    """
    if any(header in request.headers for header in FORWARDED_HEADERS):
        raise NotFound(UNKNOWN)
    if request.client is None or request.client.host not in LOCAL:
        raise NotFound(UNKNOWN)


class TrainingFind(BaseSchema):
    """Ein freigegebener Fund, so wie die Kette ihn braucht.

    ``lateinisch`` ist der Name, unter dem die Art in GBIF steht. Nur er passt
    zu den Beobachtungen, mit denen das Modell rechnet. ``lat`` und ``lon``
    sind der gesetzte Punkt, nicht gerundet.
    """

    id: str
    species_slug: str = Field(validation_alias="artSlug", serialization_alias="artSlug")
    scientific: str = Field(validation_alias="lateinisch", serialization_alias="lateinisch")
    lat: float
    lon: float
    found_on: date = Field(validation_alias="datum", serialization_alias="datum")
    count: int | None = Field(validation_alias="anzahl", serialization_alias="anzahl")


@router.get(
    "/training-funde",
    dependencies=[Depends(only_from_host)],
    summary="Freigegebene Funde fuer die Kette",
)
async def training_finds(
    session: Annotated[AsyncSession, Depends(db_session)],
    catalog: Annotated[Catalog, Depends(current_catalog)],
) -> list[TrainingFind]:
    """Liefert jeden Fund, den sein Besitzer fuer das Training freigegeben hat.

    Ein Fund, dessen Art nicht mehr im Katalog steht, faellt heraus. Die Kette
    koennte ihn keiner Beobachtung zuordnen.
    """
    query = select(Find).where(Find.for_training).order_by(Find.found_on, Find.id)
    hit = await session.scalars(query)
    released: list[TrainingFind] = []
    for find in hit:
        scientific = catalog.scientific(find.species_slug)
        if scientific is None:
            continue
        released.append(
            TrainingFind(
                id=find.id,
                species_slug=find.species_slug,
                scientific=scientific,
                lat=find.lat,
                lon=find.lon,
                found_on=find.found_on,
                count=find.count,
            )
        )
    return released
