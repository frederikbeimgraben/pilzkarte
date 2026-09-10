"""Die Rechteprüfung als Dependency.

Jede schreibende Route hängt ``requires(...)`` vor sich. Die Prüfung liegt
damit im Backend und an genau einer Stelle; das Frontend blendet nur aus.
"""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User, current_user
from app.core.db import db_session
from app.core.errors import Forbidden
from app.modules.access.permissions import Permission
from app.modules.access.service import permissions_of

Authenticated = Annotated[User, Depends(current_user)]
Session = Annotated[AsyncSession, Depends(db_session)]


def requires(permission: Permission) -> Callable[[User, AsyncSession], Awaitable[User]]:
    """Baut eine Dependency, die ohne dieses Recht mit 403 endet."""

    async def guard(user: Authenticated, session: Session) -> User:
        if permission not in await permissions_of(session, user):
            raise Forbidden(f"Dafür fehlt das Recht {permission.value}.")
        return user

    return guard
