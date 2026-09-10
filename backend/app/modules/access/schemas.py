"""Vertrag der Rollenverwaltung.

Die Feldnamen sind neu und darum englisch. Nur der Umschlag der Personenliste
trägt weiter ``eintraege`` und ``gesamt``: er kommt aus ``shared/paging`` und
gilt für jede Liste des Dienstes. R3 dreht ihn für alle auf einmal.

Die Beschriftung eines Rechts steht nicht hier: sie ist Oberflächentext und
gehört zu den übersetzbaren Zeichenketten. Die Antwort nennt nur Schlüssel
und Bereich.
"""

from typing import Annotated

from pydantic import Field

from app.models import Person, Role
from app.modules.access.permissions import Area, Permission
from app.shared.schemas import BaseSchema, Name, Timestamp

Description = Annotated[str, Field(max_length=200)]
# Ein Slug taugt als Teil einer Adresse und bleibt lesbar.
Slug = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9-]*$")]


class PermissionOut(BaseSchema):
    """Ein Recht des Katalogs."""

    key: Permission
    area: Area


class RoleBrief(BaseSchema):
    """Eine Rolle, so wie sie neben einer Person steht."""

    id: str
    slug: str
    name: str


class RoleOut(BaseSchema):
    """Eine Rolle mit ihren Rechten."""

    id: str
    slug: str
    name: str
    description: str | None
    built_in: bool
    permissions: list[Permission]
    people: int
    created_at: Timestamp
    updated_at: Timestamp


class RoleIn(BaseSchema):
    """Eine neue Rolle."""

    slug: Slug
    name: Name
    description: Description | None = None
    permissions: list[Permission] = Field(default_factory=list[Permission])


class RolePatch(BaseSchema):
    """Was sich an einer Rolle ändern lässt. Weggelassene Felder bleiben."""

    name: Name | None = None
    description: Description | None = None
    permissions: list[Permission] | None = None


class PersonOut(BaseSchema):
    """Ein Konto mit seinen Rollen.

    ``roles`` nennt nur die ausdrücklich vergebenen Rollen. Die feste Rolle
    Nutzer hat jede angemeldete Person und steht in keiner Zuweisung.
    """

    sub: str
    email: str | None
    name: str | None
    roles: list[RoleBrief]
    created_at: Timestamp


class RoleAssignment(BaseSchema):
    """Die Rollen, die eine Person danach trägt."""

    roles: list[str]


def permission_out(permission: Permission, area: Area) -> PermissionOut:
    """Baut die Antwort zu einem Recht."""
    return PermissionOut(key=permission, area=area)


def role_brief(role: Role) -> RoleBrief:
    """Baut die kurze Form einer Rolle."""
    return RoleBrief(id=role.id, slug=role.slug, name=role.name)


def role_out(role: Role, permissions: list[Permission], people: int) -> RoleOut:
    """Baut die Antwort zu einer Rolle."""
    return RoleOut(
        id=role.id,
        slug=role.slug,
        name=role.name,
        description=role.description,
        built_in=role.built_in,
        permissions=permissions,
        people=people,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


def person_out(person: Person, roles: list[Role]) -> PersonOut:
    """Baut die Antwort zu einer Person."""
    return PersonOut(
        sub=person.sub,
        email=person.email,
        name=person.name,
        roles=[role_brief(role) for role in roles],
        created_at=person.created_at,
    )
