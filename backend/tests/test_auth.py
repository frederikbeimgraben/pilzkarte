"""Pruefung der Bearer-Token und des JWKS-Speichers."""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import httpx
import pytest
from fastapi import Depends, FastAPI

from app.core import auth
from app.core.auth import (
    JwksCache,
    User,
    current_user,
    optional_user,
    user_from_token,
)
from app.core.db import session_factory
from app.core.errors import NotAuthenticated, register_error_handlers
from app.models import Person
from tests.conftest import ISSUER, FakeIdp, auth_header, ec_key, rsa_key


async def _guarded(user: Annotated[User, Depends(current_user)]) -> dict[str, str]:
    return {"sub": user.sub}


async def _open(
    user: Annotated[User | None, Depends(optional_user)],
) -> dict[str, str | None]:
    return {"sub": user.sub if user else None}


def app_with_guard() -> FastAPI:
    app = FastAPI()
    app.add_api_route("/geschuetzt", _guarded, methods=["GET"])
    app.add_api_route("/offen", _open, methods=["GET"])
    register_error_handlers(app)
    return app


def client(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_a_valid_token_yields_the_person(idp: FakeIdp) -> None:
    user = await user_from_token(idp.token())

    assert user == User(sub="nutzer-1", email="pilz@example.test", name="Pilzsammlerin")


async def test_a_token_without_email_and_name(idp: FakeIdp) -> None:
    user = await user_from_token(idp.token(email=None, name=None))

    assert user.email is None
    assert user.name is None


async def test_es256_is_accepted(idp: FakeIdp) -> None:
    idp.rotate(ec_key(), "ec-1", "ES256")

    user = await user_from_token(idp.token())

    assert user.sub == "nutzer-1"


async def test_wrong_audience(idp: FakeIdp) -> None:
    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token(aud="fremde-app"))


async def test_wrong_issuer(idp: FakeIdp) -> None:
    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token(iss="https://fremd.example.test/"))


async def test_expired_token(idp: FakeIdp) -> None:
    vorbei = datetime.now(UTC) - timedelta(hours=2)
    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token(exp=int(vorbei.timestamp())))


async def test_wrong_signature(idp: FakeIdp) -> None:
    # Gleiche Kennung, anderer Schluessel: genau der Fall, den nur die Signatur faengt.
    other = idp.token(key=rsa_key())

    with pytest.raises(NotAuthenticated):
        await user_from_token(other)


async def test_without_expiry(idp: FakeIdp) -> None:
    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token(exp=None))


@pytest.mark.usefixtures("idp")
async def test_an_unreadable_token() -> None:
    with pytest.raises(NotAuthenticated):
        await user_from_token("kein-token")


async def test_a_token_without_a_kid(idp: FakeIdp) -> None:
    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token(ohne_kid=True))


async def test_sub_is_not_a_string(idp: FakeIdp) -> None:
    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token(sub=42))


async def test_an_unknown_kid_stays_unknown(idp: FakeIdp) -> None:
    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token(kid="gibt-es-nicht"))


async def test_jwks_is_fetched_only_once(idp: FakeIdp) -> None:
    token = idp.token()

    await user_from_token(token)
    aufrufe_danach = len(idp.calls)
    await user_from_token(token)

    assert len(idp.calls) == aufrufe_danach


async def test_a_new_kid_triggers_a_reload(idp: FakeIdp) -> None:
    await user_from_token(idp.token())
    vorher = len(idp.calls)
    idp.rotate(rsa_key(), "schluessel-2")

    user = await user_from_token(idp.token())

    assert user.sub == "nutzer-1"
    assert len(idp.calls) > vorher


async def test_a_stale_cache_reloads(idp: FakeIdp) -> None:
    speicher = JwksCache(ttl=timedelta(0))

    await speicher.key(idp.kid)
    await speicher.key(idp.kid)

    assert len([call for call in idp.calls if call.endswith("jwks/")]) == 2


async def test_discovery_falls_back_to_jwks(idp: FakeIdp) -> None:
    idp.discovery = None

    user = await user_from_token(idp.token())

    assert user.sub == "nutzer-1"
    assert f"{ISSUER}jwks/" in idp.calls


async def test_discovery_without_jwks_uri(idp: FakeIdp) -> None:
    idp.discovery = {"issuer": ISSUER}

    user = await user_from_token(idp.token())

    assert user.sub == "nutzer-1"


async def test_jwks_without_a_key_list(idp: FakeIdp) -> None:
    idp.jwks = ["kein", "objekt"]

    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token())


async def test_a_jwks_entry_that_is_no_object(idp: FakeIdp) -> None:
    listing: list[Any] = ["kein-objekt"]
    idp.jwks = {"keys": listing}

    with pytest.raises(NotAuthenticated):
        await user_from_token(idp.token())


@pytest.mark.usefixtures("idp")
async def test_guarded_without_a_header_is_401() -> None:
    async with client(app_with_guard()) as call:
        response = await call.get("/geschuetzt")

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["code"] == "unauthorized"


async def test_guarded_with_a_wrong_token_is_401(idp: FakeIdp) -> None:
    async with client(app_with_guard()) as call:
        response = await call.get("/geschuetzt", headers=auth_header(idp.token(aud="fremde-app")))

    assert response.status_code == 401
    assert response.json()["title"] == "Nicht angemeldet"


@pytest.mark.usefixtures("schema")
async def test_guarded_with_a_valid_token(idp: FakeIdp) -> None:
    async with client(app_with_guard()) as call:
        response = await call.get("/geschuetzt", headers=auth_header(idp.token()))

    assert response.status_code == 200
    assert response.json() == {"sub": "nutzer-1"}


@pytest.mark.usefixtures("schema")
async def test_a_login_creates_the_account(idp: FakeIdp) -> None:
    """Die Zeile in ``nutzer`` entsteht bei der Anmeldung, nicht beim ersten Objekt.

    Der Fremdschluessel auf ``nutzer.sub`` haengt daran. Kaeme die Zeile erst
    mit dem ersten Fund, scheiterte genau dieser Fund an der Bedingung.
    """
    async with client(app_with_guard()) as call:
        await call.get("/geschuetzt", headers=auth_header(idp.token()))

    async with session_factory()() as session:
        person = await session.get(Person, "nutzer-1")

    assert person is not None
    assert (person.email, person.name) == ("pilz@example.test", "Pilzsammlerin")


@pytest.mark.usefixtures("idp")
async def test_open_without_a_token_stays_anonymous() -> None:
    async with client(app_with_guard()) as call:
        response = await call.get("/offen")

    assert response.status_code == 200
    assert response.json() == {"sub": None}


async def test_open_with_a_token_knows_the_person(idp: FakeIdp) -> None:
    async with client(app_with_guard()) as call:
        response = await call.get("/offen", headers=auth_header(idp.token()))

    assert response.json() == {"sub": "nutzer-1"}


async def test_the_net_client_carries_the_timeout() -> None:
    # Die einzige Stelle, an der das echte Netz haengt. Jeder andere Test ersetzt sie.
    async with auth.net_client() as klient_zum_netz:
        assert klient_zum_netz.timeout.connect == auth.NET_TIMEOUT
