"""Die Rechteprüfung als Dependency.

Jede schreibende Route hängt ``requires(...)`` vor sich. Die Prüfung liegt
damit im Backend und an genau einer Stelle; das Frontend blendet nur aus.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, current_user, optional_user
from app.core.db import db_session
from app.core.errors import Forbidden
from app.modules.access.permissions import Permission
from app.modules.access.service import permissions_of

Authenticated = Annotated[User, Depends(current_user)]
MaybeAuthenticated = Annotated[User | None, Depends(optional_user)]
Session = Annotated[AsyncSession, Depends(db_session)]


def requires(permission: Permission) -> Callable[[User, AsyncSession], Awaitable[User]]:
    """Baut eine Dependency, die ohne dieses Recht mit 403 endet."""

    async def guard(user: Authenticated, session: Session) -> User:
        if permission not in await permissions_of(session, user):
            raise Forbidden(f"Dafür fehlt das Recht {permission.value}.")
        return user

    return guard


async def visitor_rights(user: MaybeAuthenticated, session: Session) -> frozenset[Permission]:
    """Die Rechte des Zugriffs. Ein Zugriff ohne Konto traegt keines.

    Eine Route, die je nach Recht mehr zeigt, braucht die Menge und nicht ein
    einzelnes Ja. ``requires`` bleibt fuer alles, was ohne das Recht endet.
    """
    return frozenset() if user is None else await permissions_of(session, user)


Rights = Annotated[frozenset[Permission], Depends(visitor_rights)]


@dataclass(frozen=True, slots=True)
class Viewer:
    """Wer zugreift und was er darf. Ohne Konto ist beides leer."""

    user: User | None
    rights: frozenset[Permission]


async def current_viewer(user: MaybeAuthenticated, rights: Rights) -> Viewer:
    """Dependency: der Zugriff mitsamt seinen Rechten, auch ohne Konto."""
    return Viewer(user=user, rights=rights)


Visitor = Annotated[Viewer, Depends(current_viewer)]
