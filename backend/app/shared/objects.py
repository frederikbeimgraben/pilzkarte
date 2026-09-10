"""Eigene Objekte lesen und aendern. Jede Route eines eigenen Objekts nimmt diesen Weg."""

from collections.abc import Iterable

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User
from app.core.errors import NotFound
from app.models import Owned


async def owned[E: Owned](
    db_session: AsyncSession,
    model: type[E],
    identifier: str,
    user: User,
) -> E:
    """Liest ein Objekt, das dieser Person gehoert.

    Ein fremdes Objekt gibt es fuer diesen Zugang nicht. Es endet darum mit 404
    und nicht mit 403: ein 403 wuerde verraten, dass es das Objekt gibt.
    """
    hit = await db_session.get(model, identifier)
    if hit is None or hit.owner_sub != user.sub:
        raise NotFound("Dieses Objekt gibt es nicht.")
    return hit


def apply_patch(target: object, patch: BaseModel, without: Iterable[str] = ()) -> None:
    """Setzt die Felder, die in einer PATCH-Anfrage wirklich standen.

    Ein Feld, das niemand geschickt hat, bleibt. Ein Feld, das ausdruecklich auf
    ``null`` steht, wird geleert.
    """
    for field, value in patch.model_dump(exclude_unset=True, exclude=set(without)).items():
        setattr(target, field, value)
