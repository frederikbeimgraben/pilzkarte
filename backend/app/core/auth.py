"""Anmeldung ueber OIDC.

Das Frontend holt sich bei Authentik ein Access-Token und schickt es als
``Authorization: Bearer``. Der Dienst prueft es gegen die Signaturschluessel des
Issuers. Es gibt keine Sitzung und kein Client-Secret.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Final, cast

import httpx
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWK, PyJWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import db_session
from app.core.errors import NotAuthenticated
from app.core.people import remember
from app.core.settings import get_settings

# Authentik signiert mit dem Schluessel des Providers. Beide Verfahren kommen
# vor, je nach hinterlegtem Zertifikat.
ALGORITHMS: Final = ["RS256", "ES256"]

# Der Issuer dreht seine Schluessel selten. Eine Stunde haelt die Last klein und
# holt einen Wechsel spaetestens nach einer Stunde nach.
JWKS_TTL: Final = timedelta(hours=1)

NET_TIMEOUT: Final = 5.0


@dataclass(frozen=True, slots=True)
class User:
    """Die angemeldete Person, so wie sie im Token steht."""

    sub: str
    email: str | None
    name: str | None
    # Authentik legt die Gruppen als Liste in den Anspruch ``groups``. Sie
    # entscheiden nur über den ersten Admin, alles Weitere steht in der
    # Datenbank.
    groups: tuple[str, ...] = ()


def net_client() -> httpx.AsyncClient:
    """Liefert den Klienten fuer die Abfragen beim Issuer."""
    return httpx.AsyncClient(timeout=NET_TIMEOUT)


def _mapping(value: object) -> Mapping[str, object] | None:
    return cast("Mapping[str, object]", value) if isinstance(value, Mapping) else None


def _string(data: Mapping[str, object], field: str) -> str | None:
    value = data.get(field)
    return value if isinstance(value, str) else None


def _strings(data: Mapping[str, object], field: str) -> tuple[str, ...]:
    value = data.get(field)
    if not isinstance(value, list):
        return ()
    return tuple(entry for entry in cast("list[object]", value) if isinstance(entry, str))


class JwksCache:
    """Haelt die Signaturschluessel des Issuers im Prozess."""

    def __init__(self, ttl: timedelta = JWKS_TTL) -> None:
        self._ttl = ttl
        self._keys: dict[str, Any] = {}
        self._loaded: datetime | None = None

    def _fresh(self) -> bool:
        return self._loaded is not None and datetime.now(UTC) - self._loaded < self._ttl

    async def key(self, kid: str) -> Any | None:  # noqa: ANN401
        """Liefert den Schluessel zu einer Kennung, oder None."""
        if not self._fresh():
            await self._load()
        elif kid not in self._keys:
            # Ein unbekannter kid heisst meistens: der Issuer hat gedreht. Das ist
            # ein Grund zum Neuladen, kein Grund fuer 401.
            await self._load()
        return self._keys.get(kid)

    async def _load(self) -> None:
        async with net_client() as client:
            response = await client.get(await self._jwks_url(client))
            response.raise_for_status()
            document = _mapping(response.json())
        entries = document.get("keys") if document is not None else None
        found: dict[str, Any] = {}
        if isinstance(entries, list):
            for raw in cast("list[object]", entries):
                entry = _mapping(raw)
                if entry is None:
                    continue
                identifier = _string(entry, "kid")
                if identifier is not None:
                    found[identifier] = PyJWK(dict(entry)).key
        self._keys = found
        self._loaded = datetime.now(UTC)

    async def _jwks_url(self, client: httpx.AsyncClient) -> str:
        settings = get_settings()
        try:
            response = await client.get(settings.discovery_url)
            response.raise_for_status()
            document = _mapping(response.json())
            uri = _string(document, "jwks_uri") if document is not None else None
        except (httpx.HTTPError, ValueError):
            # Authentik liefert die Schluessel auch ohne Discovery unter jwks/.
            return settings.jwks_url
        return uri if uri is not None else settings.jwks_url


_cache = JwksCache()

_bearer = HTTPBearer(auto_error=False)


async def user_from_token(token: str) -> User:
    """Prueft ein Access-Token und liefert die Person dahinter."""
    try:
        header = jwt.get_unverified_header(token)
    except PyJWTError as error:
        raise NotAuthenticated("Das Token ist nicht lesbar.") from error

    kid = _string(header, "kid")
    if kid is None:
        raise NotAuthenticated("Dem Token fehlt die Schluesselkennung.")

    key = await _cache.key(kid)
    if key is None:
        raise NotAuthenticated("Der Schluessel des Tokens ist unbekannt.")

    settings = get_settings()
    try:
        data: Mapping[str, object] = jwt.decode(
            token,
            key,
            algorithms=ALGORITHMS,
            audience=settings.oidc_client_id,
            issuer=settings.oidc_issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except PyJWTError as error:
        raise NotAuthenticated("Das Token ist ungueltig.") from error

    # ``require`` und die Pruefung in PyJWT lassen nur ein Token mit sub als
    # Zeichenkette durch. Eine eigene Pruefung darauf waere unerreichbar.
    return User(
        sub=str(data["sub"]),
        email=_string(data, "email"),
        name=_string(data, "name"),
        groups=_strings(data, "groups"),
    )


async def optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User | None:
    """Liefert die Person, falls ein Token dabei ist. Ein falsches Token bleibt ein Fehler."""
    if credentials is None:
        return None
    return await user_from_token(credentials.credentials)


async def current_user(
    user: Annotated[User | None, Depends(optional_user)],
    session: Annotated[AsyncSession, Depends(db_session)],
) -> User:
    """Liefert die angemeldete Person. Ohne Token endet die Anfrage mit 401.

    Wer hier durchkommt, steht danach in der Personentabelle. Das ist der
    einzige Ort, an dem der Dienst erfährt, dass es ein Konto gibt.
    """
    if user is None:
        raise NotAuthenticated("Fuer diesen Zugriff ist eine Anmeldung noetig.")
    await remember(session, user.sub, user.email, user.name)
    return user
