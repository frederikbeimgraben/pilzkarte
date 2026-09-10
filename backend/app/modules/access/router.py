"""Endpunkte für Rollen, Rechte und Personen.

Wer Rollen verwaltet, braucht das Recht dafür; wer Rollen vergibt, ein
zweites. Die Trennung erlaubt eine Person, die Rollen verteilt, ohne selbst
neue Rechtebündel schneidern zu können.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import Select, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import db_session
from app.core.errors import Conflict, Invalid, NotFound
from app.models import Person, Role, RolePermission, UserRole
from app.modules.access.guard import requires
from app.modules.access.permissions import AREA_OF, Permission
from app.modules.access.schemas import (
    PermissionOut,
    PersonOut,
    RoleAssignment,
    RoleIn,
    RoleOut,
    RolePatch,
    permission_out,
    person_out,
    role_out,
)
from app.modules.access.service import ADMIN_SLUG, USER_SLUG
from app.shared.objects import apply_patch
from app.shared.paging import Page, Paging, load_page

router = APIRouter(tags=["access"])

Session = Annotated[AsyncSession, Depends(db_session)]
ManagesRoles = Depends(requires(Permission.ROLE_MANAGE))
AssignsRoles = Depends(requires(Permission.ROLE_ASSIGN))


async def role_or_404(session: AsyncSession, role_id: str) -> Role:
    """Liest eine Rolle. Eine unbekannte Kennung ist ein 404."""
    role = await session.get(Role, role_id)
    if role is None:
        raise NotFound("Diese Rolle gibt es nicht.")
    return role


def permissions_for(role: Role, granted: set[str]) -> list[Permission]:
    """Die Rechte einer Rolle, in der Reihenfolge des Katalogs.

    Admin bekommt den ganzen Katalog. Ihre Rechte stehen in keiner Zeile: was
    dort stünde, wäre beim nächsten neuen Recht schon veraltet.
    """
    if role.slug == ADMIN_SLUG:
        return list(Permission)
    return [right for right in Permission if right.value in granted]


async def granted_keys(session: AsyncSession, role_ids: list[str]) -> dict[str, set[str]]:
    """Die vergebenen Rechte je Rolle."""
    query = select(RolePermission.role_id, RolePermission.permission_key).where(
        RolePermission.role_id.in_(role_ids),
    )
    keys: dict[str, set[str]] = {role_id: set() for role_id in role_ids}
    for role_id, key in await session.execute(query):
        keys[role_id].add(key)
    return keys


async def people_counts(session: AsyncSession, role_ids: list[str]) -> dict[str, int]:
    """Wie viele Personen jede Rolle tragen."""
    query = (
        select(UserRole.role_id, func.count())
        .where(UserRole.role_id.in_(role_ids))
        .group_by(UserRole.role_id)
    )
    counts = dict.fromkeys(role_ids, 0)
    for role_id, count in await session.execute(query):
        counts[role_id] = int(count)
    return counts


async def set_permissions(session: AsyncSession, role: Role, wanted: list[Permission]) -> None:
    """Setzt die Rechte einer Rolle neu.

    Die feste Rolle Admin bleibt aussen vor: sie trägt jedes Recht und liesse
    sich sonst entrechten.
    """
    if role.slug == ADMIN_SLUG:
        raise Conflict("Die Rolle Admin trägt jedes Recht und lässt sich nicht ändern.")
    _ = await session.execute(delete(RolePermission).where(RolePermission.role_id == role.id))
    for permission in dict.fromkeys(wanted):
        session.add(RolePermission(role_id=role.id, permission_key=permission.value))


async def one_role(session: AsyncSession, role: Role) -> RoleOut:
    """Baut die Antwort zu einer Rolle samt Rechten und Personenzahl."""
    keys = await granted_keys(session, [role.id])
    counts = await people_counts(session, [role.id])
    return role_out(role, permissions_for(role, keys[role.id]), counts[role.id])


# ------------------------------------------------------------------ Rechte


@router.get("/permissions", dependencies=[ManagesRoles], summary="Der Rechtekatalog")
async def permission_list() -> list[PermissionOut]:
    """Liefert jedes Recht, das der Dienst kennt, mit seinem Bereich.

    Der Katalog steht im Code. Die Beschriftung dazu holt die Oberfläche aus
    ihren Texten, damit sie übersetzbar bleibt.
    """
    return [permission_out(right, AREA_OF[right]) for right in Permission]


# ------------------------------------------------------------------ Rollen


@router.get("/roles", dependencies=[ManagesRoles], summary="Alle Rollen")
async def role_list(session: Session) -> list[RoleOut]:
    """Liefert jede Rolle mit ihren Rechten und der Zahl ihrer Personen."""
    roles = list(await session.scalars(select(Role).order_by(Role.built_in.desc(), Role.name)))
    ids = [role.id for role in roles]
    keys = await granted_keys(session, ids)
    counts = await people_counts(session, ids)
    return [role_out(role, permissions_for(role, keys[role.id]), counts[role.id]) for role in roles]


@router.post(
    "/roles",
    dependencies=[ManagesRoles],
    status_code=status.HTTP_201_CREATED,
    summary="Rolle anlegen",
)
async def create_role(payload: RoleIn, session: Session) -> RoleOut:
    """Legt eine Rolle an. Ein Slug ist einmalig, auch gegen die festen Rollen."""
    if await session.scalar(select(Role).where(Role.slug == payload.slug)) is not None:
        raise Conflict(f"Den Slug {payload.slug} gibt es schon.")
    role = Role(slug=payload.slug, name=payload.name, description=payload.description)
    session.add(role)
    await session.flush()
    await set_permissions(session, role, payload.permissions)
    await session.commit()
    await session.refresh(role)
    return await one_role(session, role)


@router.get("/roles/{role_id}", dependencies=[ManagesRoles], summary="Eine Rolle")
async def read_role(role_id: str, session: Session) -> RoleOut:
    """Liefert eine Rolle mit ihren Rechten."""
    return await one_role(session, await role_or_404(session, role_id))


@router.patch("/roles/{role_id}", dependencies=[ManagesRoles], summary="Rolle ändern")
async def patch_role(role_id: str, patch: RolePatch, session: Session) -> RoleOut:
    """Ändert Name, Beschreibung oder Rechte. Weggelassene Felder bleiben."""
    role = await role_or_404(session, role_id)
    apply_patch(role, patch, without={"permissions"})
    if patch.permissions is not None:
        await set_permissions(session, role, patch.permissions)
    await session.commit()
    await session.refresh(role)
    return await one_role(session, role)


@router.delete(
    "/roles/{role_id}",
    dependencies=[ManagesRoles],
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Rolle löschen",
)
async def delete_role(role_id: str, session: Session) -> Response:
    """Löscht eine Rolle. Die beiden festen Rollen bleiben."""
    role = await role_or_404(session, role_id)
    if role.built_in:
        raise Conflict(f"Die feste Rolle {role.name} lässt sich nicht löschen.")
    # SQLite erzwingt Fremdschlüssel nur mit eingeschaltetem Pragma. Die
    # Kinderzeilen gehen darum von Hand, sonst bleiben sie als Waisen liegen.
    _ = await session.execute(delete(RolePermission).where(RolePermission.role_id == role.id))
    _ = await session.execute(delete(UserRole).where(UserRole.role_id == role.id))
    await session.delete(role)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------ Personen


def people_query(search: str | None) -> Select[tuple[Person]]:
    """Die Personen, nach Name und E-Mail durchsuchbar."""
    query = select(Person).order_by(Person.created_at)
    if search is None:
        return query
    like = f"%{search.lower()}%"
    return query.where(
        func.lower(func.coalesce(Person.name, "")).like(like)
        | func.lower(func.coalesce(Person.email, "")).like(like),
    )


async def roles_of_people(session: AsyncSession, subs: list[str]) -> dict[str, list[Role]]:
    """Die ausdrücklich vergebenen Rollen je Person."""
    query = (
        select(UserRole.user_sub, Role)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_sub.in_(subs))
        .order_by(Role.name)
    )
    roles: dict[str, list[Role]] = {sub: [] for sub in subs}
    for sub, role in await session.execute(query):
        roles[sub].append(role)
    return roles


def itself(person: Person) -> Person:
    """Die Seite trägt zunächst die Zeilen selbst: die Rollen kommen danach."""
    return person


@router.get("/people", dependencies=[AssignsRoles], summary="Alle Konten")
async def people_list(
    session: Session,
    paging: Paging,
    q: Annotated[str | None, Query(description="Sucht in Name und E-Mail")] = None,
) -> Page[PersonOut]:
    """Liefert die Konten, die den Dienst schon benutzt haben."""
    page = await load_page(session, people_query(q), paging, itself)
    roles = await roles_of_people(session, [person.sub for person in page.entries])
    return Page(
        entries=[person_out(person, roles[person.sub]) for person in page.entries],
        total=page.total,
        limit=page.limit,
        offset=page.offset,
    )


async def person_or_404(session: AsyncSession, sub: str) -> Person:
    """Liest eine Person. Ein unbekannter ``sub`` ist ein 404."""
    person = await session.get(Person, sub)
    if person is None:
        raise NotFound("Diese Person gibt es nicht.")
    return person


@router.get("/people/{sub}", dependencies=[AssignsRoles], summary="Ein Konto")
async def read_person(sub: str, session: Session) -> PersonOut:
    """Liefert ein Konto mit seinen Rollen."""
    person = await person_or_404(session, sub)
    roles = await roles_of_people(session, [person.sub])
    return person_out(person, roles[person.sub])


@router.put("/people/{sub}/roles", dependencies=[AssignsRoles], summary="Rollen vergeben")
async def set_roles(sub: str, assignment: RoleAssignment, session: Session) -> PersonOut:
    """Setzt die Rollen einer Person neu.

    Die feste Rolle Nutzer steht in keiner Zuweisung: sie gilt jeder
    angemeldeten Person. Sie hier zu vergeben wäre eine Zeile, die nichts
    sagt, und beim Entfernen ein falsches Versprechen.
    """
    person = await person_or_404(session, sub)
    wanted = list(dict.fromkeys(assignment.roles))
    roles = list(await session.scalars(select(Role).where(Role.id.in_(wanted))))
    found = {role.id for role in roles}
    missing = [role_id for role_id in wanted if role_id not in found]
    if missing:
        raise Invalid(f"Diese Rollen gibt es nicht: {', '.join(missing)}.")
    if any(role.slug == USER_SLUG for role in roles):
        raise Invalid("Die Rolle Nutzer hat jede angemeldete Person, sie wird nicht vergeben.")
    _ = await session.execute(delete(UserRole).where(UserRole.user_sub == person.sub))
    for role in roles:
        session.add(UserRole(user_sub=person.sub, role_id=role.id))
    await session.commit()
    roles_after = await roles_of_people(session, [person.sub])
    return person_out(person, roles_after[person.sub])
