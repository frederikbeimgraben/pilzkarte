"""Rollen, Rechte und Personen.

Die Vorrichtung baut drei Konten: eine Person mit der Admin-Gruppe im Token,
eine mit einer eigenen Rolle und eine ohne alles. An ihnen lässt sich jede
Regel einzeln prüfen.
"""

from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select

from app.core.auth import User
from app.core.db import session_factory
from app.models import PermissionRow, Person, Role, RolePermission, UserRole
from app.modules.access.permissions import ALL_PERMISSIONS, AREA_OF, Area, Permission
from app.modules.access.service import (
    ADMIN_SLUG,
    BUILT_IN_ROLES,
    USER_SLUG,
    ensure_built_in_roles,
    permissions_of,
    sync_permissions,
)
from tests.conftest import FakeIdp, auth_header

ADMIN_GROUP = "pilze-admins"
ROOT = "nutzer-root"
HELPER = "nutzer-helfer"
GUEST = "nutzer-gast"


def as_root(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines Kontos mit der Admin-Gruppe im Token."""
    return dict(auth_header(idp.token(sub=ROOT, name="Frederik", groups=[ADMIN_GROUP])))


def as_helper(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines Kontos ohne Gruppe. Seine Rechte stehen in der Datenbank."""
    return dict(auth_header(idp.token(sub=HELPER, name="Jonas", email="jonas@example.test")))


def as_guest(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines Kontos ohne jedes Recht."""
    return dict(auth_header(idp.token(sub=GUEST, name="Testerin")))


@pytest.fixture
async def seeded(schema: None) -> None:  # noqa: ARG001
    """Legt Rechtekatalog und feste Rollen an, so wie der Start es tut."""
    async with session_factory()() as session:
        await sync_permissions(session)
        await ensure_built_in_roles(session)


@pytest.fixture
def call(object_app: FastAPI, seeded: None) -> httpx.AsyncClient:  # noqa: ARG001
    """Ein Klient gegen die App mit fertigem Rechtekatalog."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=object_app),
        base_url="http://test",
    )


async def create_role(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    **override: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt eine Rolle an und liefert die Antwort."""
    body: dict[str, Any] = {
        "slug": "berater",
        "name": "Pilzberater",
        "description": "Arten und Bilder pflegen.",
        "permissions": ["species.edit", "image.review"],
    }
    body.update(override)
    response = await call.post("/api/roles", json=body, headers=as_root(idp))
    assert response.status_code == 201, response.text
    return response.json()


# ------------------------------------------------------------------ Der Katalog


def test_every_permission_has_an_area() -> None:
    # Ein neues Recht ohne Bereich stünde in der Verwaltung unter keiner Gruppe.
    assert set(AREA_OF) == set(Permission)
    assert set(AREA_OF.values()) <= set(Area)


def test_the_catalogue_is_the_admin_set() -> None:
    assert frozenset(Permission) == ALL_PERMISSIONS


async def test_the_catalogue_reaches_the_endpoint(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        response = await call.get("/api/permissions", headers=as_root(idp))

    keys = [entry["key"] for entry in response.json()]
    assert response.status_code == 200
    assert keys == [right.value for right in Permission]
    assert {entry["area"] for entry in response.json()} == {area.value for area in Area}


# ------------------------------------------------------------------ Wer welches Recht hat


async def test_the_admin_group_carries_every_permission(seeded: None) -> None:  # noqa: ARG001
    user = User(sub=ROOT, email=None, name=None, groups=(ADMIN_GROUP,))

    async with session_factory()() as session:
        assert await permissions_of(session, user) == ALL_PERMISSIONS


async def test_a_person_without_a_role_has_nothing(seeded: None) -> None:  # noqa: ARG001
    user = User(sub=GUEST, email=None, name=None)

    async with session_factory()() as session:
        assert await permissions_of(session, user) == frozenset()


async def test_a_new_permission_reaches_admin_without_anybody_lifting_a_finger(
    seeded: None,  # noqa: ARG001
) -> None:
    # Der Katalog steht im Code. Admin ist als "alles" definiert, nicht als
    # Liste von Zeilen, darum trägt sie auch ein Recht, das es heute noch
    # nicht gibt.
    user = User(sub=ROOT, email=None, name=None, groups=(ADMIN_GROUP,))

    async with session_factory()() as session:
        session.add(Person(sub=ROOT))
        await session.commit()
        rights = await permissions_of(session, user)

    assert rights == ALL_PERMISSIONS
    assert Permission.RUN_MANAGE in rights


async def test_the_admin_role_carries_every_permission_too(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Die Gruppe im Token holt den ersten Admin. Danach vergibt man die Rolle,
    # und die muss dasselbe tragen.
    async with call:
        roles = (await call.get("/api/roles", headers=as_root(idp))).json()
        admin = next(role for role in roles if role["slug"] == ADMIN_SLUG)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        response = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [admin["id"]]},
            headers=as_root(idp),
        )
        assert response.status_code == 200

    async with session_factory()() as session:
        rights = await permissions_of(session, User(sub=HELPER, email=None, name=None))

    assert rights == ALL_PERMISSIONS


async def test_roles_add_up(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        first = await create_role(call, idp, slug="berater", permissions=["species.edit"])
        second = await create_role(
            call,
            idp,
            slug="uebersetzer",
            name="Übersetzer",
            permissions=["text.edit"],
        )
        # Das Konto muss dem Dienst bekannt sein, bevor es Rollen bekommt.
        _ = await call.get("/api/ich", headers=as_helper(idp))
        response = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [first["id"], second["id"]]},
            headers=as_root(idp),
        )
        assert response.status_code == 200

    user = User(sub=HELPER, email=None, name=None)
    async with session_factory()() as session:
        assert await permissions_of(session, user) == {
            Permission.SPECIES_EDIT,
            Permission.TEXT_EDIT,
        }


async def test_the_built_in_user_role_reaches_everybody(
    call: httpx.AsyncClient, idp: FakeIdp
) -> None:
    async with call:
        roles = (await call.get("/api/roles", headers=as_root(idp))).json()
        user_role = next(role for role in roles if role["slug"] == USER_SLUG)
        # Wer allen etwas geben will, gibt es der Rolle Nutzer.
        patched = await call.patch(
            f"/api/roles/{user_role['id']}",
            json={"permissions": ["image.upload"]},
            headers=as_root(idp),
        )
        assert patched.status_code == 200

    person = User(sub=GUEST, email=None, name=None)
    async with session_factory()() as session:
        assert await permissions_of(session, person) == {Permission.IMAGE_UPLOAD}


async def test_a_permission_the_code_no_longer_knows_does_not_count(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        role = await create_role(call, idp, permissions=["species.edit"])
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [role["id"]]},
            headers=as_root(idp),
        )

    async with session_factory()() as session:
        # Ein Recht aus einer früheren Fassung des Katalogs, noch mit Zeile.
        session.add(PermissionRow(key="mond.leuchten", area="species"))
        session.add(RolePermission(role_id=role["id"], permission_key="mond.leuchten"))
        await session.commit()
        rights = await permissions_of(session, User(sub=HELPER, email=None, name=None))

    assert rights == {Permission.SPECIES_EDIT}


# ------------------------------------------------------------------ Die Prüfung


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        pytest.param("get", "/api/permissions", None, id="rechte-lesen"),
        pytest.param("get", "/api/roles", None, id="rollen-lesen"),
        pytest.param("post", "/api/roles", {"slug": "x", "name": "X"}, id="rolle-anlegen"),
        pytest.param("get", "/api/roles/egal", None, id="rolle-lesen"),
        pytest.param("patch", "/api/roles/egal", {"name": "X"}, id="rolle-aendern"),
        pytest.param("delete", "/api/roles/egal", None, id="rolle-loeschen"),
        pytest.param("get", "/api/people", None, id="personen-lesen"),
        pytest.param("get", f"/api/people/{GUEST}", None, id="person-lesen"),
        pytest.param("put", f"/api/people/{GUEST}/roles", {"roles": []}, id="rollen-vergeben"),
    ],
)
async def test_without_the_permission_every_route_answers_403(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    method: str,
    path: str,
    body: dict[str, Any] | None,
) -> None:
    async with call:
        response = await call.request(method.upper(), path, json=body, headers=as_guest(idp))

    assert response.status_code == 403
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "forbidden"


async def test_without_a_token_the_routes_answer_401(call: httpx.AsyncClient) -> None:
    async with call:
        response = await call.get("/api/roles")

    assert response.status_code == 401


async def test_the_two_permissions_are_separate(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        assigner = await create_role(
            call,
            idp,
            slug="verteiler",
            name="Verteiler",
            permissions=["role.assign"],
        )
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [assigner["id"]]},
            headers=as_root(idp),
        )
        people = await call.get("/api/people", headers=as_helper(idp))
        roles = await call.get("/api/roles", headers=as_helper(idp))

    # Wer Rollen verteilt, schneidert deswegen noch keine neuen.
    assert people.status_code == 200
    assert roles.status_code == 403


# ------------------------------------------------------------------ Rollen


async def test_a_fresh_database_carries_the_two_built_in_roles(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.get("/api/roles", headers=as_root(idp))

    roles = {role["slug"]: role for role in response.json()}
    assert set(roles) == {slug.slug for slug in BUILT_IN_ROLES}
    assert roles[ADMIN_SLUG]["builtIn"] is True
    assert roles[USER_SLUG]["builtIn"] is True


async def test_admin_reports_every_permission(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        roles = (await call.get("/api/roles", headers=as_root(idp))).json()

    admin = next(role for role in roles if role["slug"] == ADMIN_SLUG)
    assert admin["permissions"] == [right.value for right in Permission]


async def test_a_role_can_be_created_read_and_changed(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_role(call, idp)
        read_back = await call.get(f"/api/roles/{created['id']}", headers=as_root(idp))
        patched = await call.patch(
            f"/api/roles/{created['id']}",
            json={"name": "Beraterin", "permissions": ["species.edit"]},
            headers=as_root(idp),
        )

    assert created["permissions"] == ["species.edit", "image.review"]
    assert created["people"] == 0
    assert read_back.json() == created
    assert patched.json()["name"] == "Beraterin"
    assert patched.json()["permissions"] == ["species.edit"]
    assert patched.json()["description"] == created["description"]


async def test_a_slug_is_taken_only_once(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        _ = await create_role(call, idp)
        again = await call.post(
            "/api/roles",
            json={"slug": "berater", "name": "Zweiter"},
            headers=as_root(idp),
        )
        built_in = await call.post(
            "/api/roles",
            json={"slug": ADMIN_SLUG, "name": "Zweiter Admin"},
            headers=as_root(idp),
        )

    assert again.status_code == 409
    assert built_in.status_code == 409


@pytest.mark.parametrize("slug", ["Gross", "mit leerzeichen", "1zahl", ""])
async def test_a_slug_outside_the_form_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    slug: str,
) -> None:
    async with call:
        response = await call.post(
            "/api/roles",
            json={"slug": slug, "name": "Egal"},
            headers=as_root(idp),
        )

    assert response.status_code == 422


async def test_a_permission_outside_the_catalogue_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.post(
            "/api/roles",
            json={"slug": "egal", "name": "Egal", "permissions": ["mond.leuchten"]},
            headers=as_root(idp),
        )

    assert response.status_code == 422


async def test_an_unknown_role_is_not_found(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        read_back = await call.get("/api/roles/gibt-es-nicht", headers=as_root(idp))
        patched = await call.patch(
            "/api/roles/gibt-es-nicht",
            json={"name": "X"},
            headers=as_root(idp),
        )
        deleted = await call.delete("/api/roles/gibt-es-nicht", headers=as_root(idp))

    assert [read_back.status_code, patched.status_code, deleted.status_code] == [404, 404, 404]


async def test_a_built_in_role_cannot_be_deleted(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        roles = (await call.get("/api/roles", headers=as_root(idp))).json()
        for role in roles:
            response = await call.delete(f"/api/roles/{role['id']}", headers=as_root(idp))
            assert response.status_code == 409, role["slug"]
            assert "lässt sich nicht löschen" in response.json()["detail"]


async def test_admin_cannot_be_stripped_of_its_permissions(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        roles = (await call.get("/api/roles", headers=as_root(idp))).json()
        admin = next(role for role in roles if role["slug"] == ADMIN_SLUG)
        stripped = await call.patch(
            f"/api/roles/{admin['id']}",
            json={"permissions": []},
            headers=as_root(idp),
        )
        renamed = await call.patch(
            f"/api/roles/{admin['id']}",
            json={"name": "Chefin"},
            headers=as_root(idp),
        )

    assert stripped.status_code == 409
    assert renamed.status_code == 200
    assert renamed.json()["permissions"] == [right.value for right in Permission]


async def test_a_free_role_can_be_deleted_with_its_rows(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        role = await create_role(call, idp)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [role["id"]]},
            headers=as_root(idp),
        )
        deleted = await call.delete(f"/api/roles/{role['id']}", headers=as_root(idp))
        gone = await call.get(f"/api/roles/{role['id']}", headers=as_root(idp))

    assert deleted.status_code == 204
    assert gone.status_code == 404
    async with session_factory()() as session:
        assert list(await session.scalars(select(RolePermission.role_id))) == []
        assert list(await session.scalars(select(UserRole.role_id))) == []


# ------------------------------------------------------------------ Personen


async def test_a_person_appears_after_the_first_visit(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        before = await call.get("/api/people", headers=as_root(idp))
        _ = await call.get("/api/ich", headers=as_helper(idp))
        after = await call.get("/api/people", headers=as_root(idp))

    # Der Aufruf mit dem Wurzelkonto legt dieses selbst an.
    assert before.json()["gesamt"] == 1
    assert after.json()["gesamt"] == 2
    jonas = next(person for person in after.json()["eintraege"] if person["sub"] == HELPER)
    assert jonas["email"] == "jonas@example.test"
    assert jonas["name"] == "Jonas"
    assert jonas["roles"] == []


async def test_a_changed_name_is_pulled_in(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.get(
            "/api/ich",
            headers=dict(
                auth_header(
                    idp.token(sub=HELPER, name="Jonas Weber", email="jonas@example.test"),
                ),
            ),
        )
        people = await call.get("/api/people", headers=as_root(idp))

    jonas = next(person for person in people.json()["eintraege"] if person["sub"] == HELPER)
    assert jonas["name"] == "Jonas Weber"
    assert jonas["email"] == "jonas@example.test"


async def test_the_person_list_searches_and_pages(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.get("/api/ich", headers=as_guest(idp))
        found = await call.get("/api/people?q=JONAS", headers=as_root(idp))
        by_mail = await call.get("/api/people?q=jonas@", headers=as_root(idp))
        page = await call.get("/api/people?limit=1&offset=1", headers=as_root(idp))

    assert [person["sub"] for person in found.json()["eintraege"]] == [HELPER]
    assert by_mail.json()["gesamt"] == 1
    assert page.json()["gesamt"] == 3
    assert len(page.json()["eintraege"]) == 1


async def test_an_unknown_person_is_not_found(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        read_back = await call.get("/api/people/gibt-es-nicht", headers=as_root(idp))
        assigned = await call.put(
            "/api/people/gibt-es-nicht/roles",
            json={"roles": []},
            headers=as_root(idp),
        )

    assert read_back.status_code == 404
    assert assigned.status_code == 404


async def test_roles_replace_each_other_on_assignment(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        first = await create_role(call, idp, slug="berater")
        second = await create_role(call, idp, slug="uebersetzer", name="Übersetzer")
        _ = await call.get("/api/ich", headers=as_helper(idp))
        both = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [first["id"], second["id"]]},
            headers=as_root(idp),
        )
        only_one = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [second["id"], second["id"]]},
            headers=as_root(idp),
        )
        read_back = await call.get(f"/api/people/{HELPER}", headers=as_root(idp))

    assert [role["slug"] for role in both.json()["roles"]] == ["berater", "uebersetzer"]
    assert [role["slug"] for role in only_one.json()["roles"]] == ["uebersetzer"]
    assert read_back.json()["roles"] == only_one.json()["roles"]


async def test_an_unknown_role_cannot_be_assigned(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        _ = await call.get("/api/ich", headers=as_helper(idp))
        response = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": ["gibt-es-nicht"]},
            headers=as_root(idp),
        )

    assert response.status_code == 422
    assert "gibt-es-nicht" in response.json()["detail"]


async def test_the_user_role_is_not_handed_out(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        roles = (await call.get("/api/roles", headers=as_root(idp))).json()
        user_role = next(role for role in roles if role["slug"] == USER_SLUG)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        response = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [user_role["id"]]},
            headers=as_root(idp),
        )

    assert response.status_code == 422
    assert "jede angemeldete Person" in response.json()["detail"]


async def test_a_role_counts_its_people(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        role = await create_role(call, idp)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [role["id"]]},
            headers=as_root(idp),
        )
        read_back = await call.get(f"/api/roles/{role['id']}", headers=as_root(idp))

    assert read_back.json()["people"] == 1


# ------------------------------------------------------------------ Abgleich


async def test_the_sync_adds_removes_and_corrects(schema: None) -> None:  # noqa: ARG001
    async with session_factory()() as session:
        await sync_permissions(session)
        rows = {row.key: row.area for row in await session.scalars(select(PermissionRow))}
        assert rows == {right.value: AREA_OF[right].value for right in Permission}


async def test_the_sync_is_idempotent_and_cleans_up(schema: None) -> None:  # noqa: ARG001
    async with session_factory()() as session:
        await sync_permissions(session)
        await ensure_built_in_roles(session)
        # Ein Recht aus einer früheren Fassung, samt Zeile an einer Rolle.
        session.add(PermissionRow(key="mond.leuchten", area="species"))
        admin = await session.scalar(select(Role).where(Role.slug == ADMIN_SLUG))
        assert admin is not None
        session.add(RolePermission(role_id=admin.id, permission_key="mond.leuchten"))
        # Ein Bereich, den jemand von Hand verstellt hat.
        stale = await session.get(PermissionRow, Permission.TEXT_EDIT.value)
        assert stale is not None
        stale.area = "access"
        await session.commit()

        await sync_permissions(session)
        await ensure_built_in_roles(session)

        keys = set(await session.scalars(select(PermissionRow.key)))
        left = list(await session.scalars(select(RolePermission.permission_key)))
        fixed = await session.get(PermissionRow, Permission.TEXT_EDIT.value)
        roles = list(await session.scalars(select(Role.slug)))

    assert keys == {right.value for right in Permission}
    assert left == []
    assert fixed is not None
    assert fixed.area == Area.INTERFACE.value
    assert sorted(roles) == sorted(role.slug for role in BUILT_IN_ROLES)


# ------------------------------------------------------------------ Der letzte Admin


async def admin_id(call: httpx.AsyncClient, idp: FakeIdp) -> str:
    """Die Kennung der festen Rolle Admin."""
    roles = (await call.get("/api/roles", headers=as_root(idp))).json()
    return str(next(role for role in roles if role["slug"] == ADMIN_SLUG)["id"])


async def test_the_last_admin_cannot_be_stripped_of_the_role(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        admin = await admin_id(call, idp)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [admin]},
            headers=as_root(idp),
        )
        stripped = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": []},
            headers=as_root(idp),
        )
        read_back = await call.get(f"/api/people/{HELPER}", headers=as_root(idp))

    assert stripped.status_code == 409
    assert stripped.headers["content-type"].startswith("application/problem+json")
    assert stripped.json()["code"] == "conflict"
    assert "letzte Person" in stripped.json()["detail"]
    assert [role["slug"] for role in read_back.json()["roles"]] == [ADMIN_SLUG]


async def test_the_last_admin_keeps_the_role_while_other_roles_change(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        admin = await admin_id(call, idp)
        other = await create_role(call, idp)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [admin]},
            headers=as_root(idp),
        )
        added = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [admin, other["id"]]},
            headers=as_root(idp),
        )
        dropped = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [other["id"]]},
            headers=as_root(idp),
        )

    assert [role["slug"] for role in added.json()["roles"]] == [ADMIN_SLUG, "berater"]
    assert dropped.status_code == 409


async def test_an_admin_may_step_down_while_a_second_one_stays(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        admin = await admin_id(call, idp)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.get("/api/ich", headers=as_guest(idp))
        for sub in (HELPER, GUEST):
            _ = await call.put(
                f"/api/people/{sub}/roles",
                json={"roles": [admin]},
                headers=as_root(idp),
            )
        first = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": []},
            headers=as_root(idp),
        )
        # Jetzt trägt nur noch das Gastkonto die Rolle, und sie bleibt.
        second = await call.put(
            f"/api/people/{GUEST}/roles",
            json={"roles": []},
            headers=as_root(idp),
        )

    assert first.status_code == 200
    assert first.json()["roles"] == []
    assert second.status_code == 409


async def test_a_person_without_the_admin_role_is_not_the_last_admin(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Die Sperre darf nicht jede Zuweisung treffen, nur die, die den letzten
    # Admin entrechtet.
    async with call:
        admin = await admin_id(call, idp)
        other = await create_role(call, idp)
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.get("/api/ich", headers=as_guest(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [admin]},
            headers=as_root(idp),
        )
        _ = await call.put(
            f"/api/people/{GUEST}/roles",
            json={"roles": [other["id"]]},
            headers=as_root(idp),
        )
        cleared = await call.put(
            f"/api/people/{GUEST}/roles",
            json={"roles": []},
            headers=as_root(idp),
        )

    assert cleared.status_code == 200


# ------------------------------------------------------------------ Die eigenen Rechte


async def test_own_permissions_need_no_permission_of_their_own(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Ohne diesen Endpunkt müsste das Frontend die Rollenliste lesen, und dafür
    # bräuchte jede Person das Recht, Rollen zu verwalten.
    async with call:
        response = await call.get("/api/me/permissions", headers=as_guest(idp))

    assert response.status_code == 200
    assert response.json() == {"permissions": []}


async def test_own_permissions_report_the_whole_catalogue_for_an_admin(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.get("/api/me/permissions", headers=as_root(idp))

    assert response.json()["permissions"] == [right.value for right in Permission]


async def test_own_permissions_sum_up_the_roles(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        first = await create_role(call, idp, slug="berater", permissions=["species.edit"])
        second = await create_role(
            call,
            idp,
            slug="uebersetzer",
            name="Übersetzer",
            permissions=["text.edit"],
        )
        _ = await call.get("/api/ich", headers=as_helper(idp))
        _ = await call.put(
            f"/api/people/{HELPER}/roles",
            json={"roles": [first["id"], second["id"]]},
            headers=as_root(idp),
        )
        response = await call.get("/api/me/permissions", headers=as_helper(idp))

    # Die Reihenfolge folgt dem Katalog, nicht der Reihenfolge der Rollen.
    assert response.json()["permissions"] == [
        Permission.SPECIES_EDIT.value,
        Permission.TEXT_EDIT.value,
    ]


async def test_own_permissions_without_a_token_answer_401(call: httpx.AsyncClient) -> None:
    async with call:
        response = await call.get("/api/me/permissions")

    assert response.status_code == 401
