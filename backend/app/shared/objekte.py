"""Eigene Objekte lesen und aendern. Jede Route von Fund, Marker und Zone nimmt diesen Weg."""

from collections.abc import Iterable

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Nutzer
from app.core.errors import NichtGefunden
from app.models import Besitztum


async def eigenes[E: Besitztum](
    sitzung: AsyncSession,
    modell: type[E],
    kennung: str,
    nutzer: Nutzer,
) -> E:
    """Liest ein Objekt, das dieser Person gehoert.

    Ein fremdes Objekt gibt es fuer diesen Zugang nicht. Es endet darum mit 404
    und nicht mit 403: ein 403 wuerde verraten, dass es das Objekt gibt.
    """
    treffer = await sitzung.get(modell, kennung)
    if treffer is None or treffer.besitzer_sub != nutzer.sub:
        raise NichtGefunden("Dieses Objekt gibt es nicht.")
    return treffer


def uebernehmen(objekt: object, aenderung: BaseModel, ausser: Iterable[str] = ()) -> None:
    """Setzt die Felder, die in einer PATCH-Anfrage wirklich standen.

    Ein Feld, das niemand geschickt hat, bleibt. Ein Feld, das ausdruecklich auf
    ``null`` steht, wird geleert.
    """
    for feld, wert in aenderung.model_dump(exclude_unset=True, exclude=set(ausser)).items():
        setattr(objekt, feld, wert)
