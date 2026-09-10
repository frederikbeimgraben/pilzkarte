"""Wer welches Recht trägt.

Drei Wege führen zu einem Recht, und sie summieren sich:

* Die Gruppe aus dem Token. Wer ``PILZE_ADMIN_GROUP`` trägt, ist Admin, auch
  ohne Zeile in der Datenbank. Sonst wäre nach dem ersten Deploy niemand da,
  der Rollen vergeben kann.
* Die feste Rolle Admin. Sie trägt jedes Recht des Katalogs, auch ein neu
  eingeführtes, ohne dass jemand etwas anhakt.
* Jede weitere Rolle der Person, dazu die feste Rolle Nutzer, die jede
  angemeldete Person hat.
"""

from dataclasses import dataclass
from typing import Final

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import User
from app.core.settings import get_settings
from app.models import PermissionRow, Role, RolePermission, UserRole
from app.modules.access.permissions import ALL_PERMISSIONS, AREA_OF, Permission

# Die beiden festen Rollen. Ihr Slug trägt die Bedeutung, nicht ihr Name.
ADMIN_SLUG: Final = "admin"
USER_SLUG: Final = "user"
BUILT_IN_SLUGS: Final = frozenset({ADMIN_SLUG, USER_SLUG})


@dataclass(frozen=True, slots=True)
class BuiltInRole:
    """Eine Rolle, die es immer gibt."""

    id: str
    slug: str
    name: str
    description: str


# Die Kennung steht fest, damit ein zweiter Lauf keine zweite Zeile anlegt.
# Die Migration legt sie an, der Start zieht eine fehlende nach.
BUILT_IN_ROLES: Final[tuple[BuiltInRole, ...]] = (
    BuiltInRole(
        id="00000000-0000-4000-8000-000000000001",
        slug=ADMIN_SLUG,
        name="Admin",
        description="Trägt jedes Recht, auch jedes neu eingeführte.",
    ),
    BuiltInRole(
        id="00000000-0000-4000-8000-000000000002",
        slug=USER_SLUG,
        name="Nutzer",
        description="Hat jede angemeldete Person. Lesen und eigene Einträge.",
    ),
)


async def ensure_built_in_roles(session: AsyncSession) -> None:
    """Legt die festen Rollen an, falls eine fehlt."""
    taken = set(await session.scalars(select(Role.slug)))
    for role in BUILT_IN_ROLES:
        if role.slug not in taken:
            session.add(
                Role(
                    id=role.id,
                    slug=role.slug,
                    name=role.name,
                    description=role.description,
                    built_in=True,
                ),
            )
    await session.commit()


def in_admin_group(user: User) -> bool:
    """Sagt, ob die Person die Admin-Gruppe im Token trägt."""
    return get_settings().admin_group in user.groups


async def sync_permissions(session: AsyncSession) -> None:
    """Gleicht die Tabelle ``permission`` mit dem Katalog im Code ab.

    Ein neues Recht braucht damit keine eigene Migration. Ein Recht, das der
    Code nicht mehr kennt, verschwindet samt seiner Zeilen in
    ``role_permission``; sonst hinge eine Rolle an einem Recht, das niemand
    mehr prüft.
    """
    known = {row.key: row for row in await session.scalars(select(PermissionRow))}
    for permission in Permission:
        area = AREA_OF[permission]
        row = known.pop(permission.value, None)
        if row is None:
            session.add(PermissionRow(key=permission.value, area=area.value))
        elif row.area != area.value:
            row.area = area.value
    for gone in known.values():
        # SQLite erzwingt Fremdschlüssel nur mit Pragma; die Zeilen in
        # role_permission gehen darum von Hand mit.
        _ = await session.execute(
            delete(RolePermission).where(RolePermission.permission_key == gone.key),
        )
        await session.delete(gone)
    await session.commit()


async def role_slugs_of(session: AsyncSession, sub: str) -> set[str]:
    """Die Slugs der Rollen, die einer Person ausdrücklich gegeben wurden."""
    query = (
        select(Role.slug)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_sub == sub,
        )
    )
    return set(await session.scalars(query))


async def permissions_of(session: AsyncSession, user: User) -> frozenset[Permission]:
    """Alle Rechte einer Person."""
    if in_admin_group(user):
        return ALL_PERMISSIONS
    slugs = await role_slugs_of(session, user.sub)
    if ADMIN_SLUG in slugs:
        return ALL_PERMISSIONS
    # Die feste Rolle Nutzer steht in keiner Zuweisung, sie gilt trotzdem.
    slugs.add(USER_SLUG)
    query = (
        select(RolePermission.permission_key)
        .join(Role, Role.id == RolePermission.role_id)
        .where(Role.slug.in_(slugs))
    )
    keys = set(await session.scalars(query))
    # Ein Recht, das der Code nicht mehr kennt, zählt nicht mehr. Der Abgleich
    # räumt es weg, aber erst beim nächsten Start.
    return frozenset(right for right in Permission if right.value in keys)
