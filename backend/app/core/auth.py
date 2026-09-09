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

from app.core.errors import AnmeldungFehlt
from app.core.settings import einstellungen

# Authentik signiert mit dem Schluessel des Providers. Beide Verfahren kommen
# vor, je nach hinterlegtem Zertifikat.
ALGORITHMEN: Final = ["RS256", "ES256"]

# Der Issuer dreht seine Schluessel selten. Eine Stunde haelt die Last klein und
# holt einen Wechsel spaetestens nach einer Stunde nach.
JWKS_TTL: Final = timedelta(hours=1)

NETZ_ZEITGRENZE: Final = 5.0


@dataclass(frozen=True, slots=True)
class Nutzer:
    """Die angemeldete Person, so wie sie im Token steht."""

    sub: str
    email: str | None
    name: str | None


def netzklient() -> httpx.AsyncClient:
    """Liefert den Klienten fuer die Abfragen beim Issuer."""
    return httpx.AsyncClient(timeout=NETZ_ZEITGRENZE)


def _abbild(wert: object) -> Mapping[str, object] | None:
    return cast("Mapping[str, object]", wert) if isinstance(wert, Mapping) else None


def _text(daten: Mapping[str, object], feld: str) -> str | None:
    wert = daten.get(feld)
    return wert if isinstance(wert, str) else None


class JwksSpeicher:
    """Haelt die Signaturschluessel des Issuers im Prozess."""

    def __init__(self, ttl: timedelta = JWKS_TTL) -> None:
        self._ttl = ttl
        self._schluessel: dict[str, Any] = {}
        self._geladen: datetime | None = None

    def _frisch(self) -> bool:
        return self._geladen is not None and datetime.now(UTC) - self._geladen < self._ttl

    async def schluessel(self, kid: str) -> Any | None:  # noqa: ANN401
        """Liefert den Schluessel zu einer Kennung, oder None."""
        if not self._frisch():
            await self._laden()
        elif kid not in self._schluessel:
            # Ein unbekannter kid heisst meistens: der Issuer hat gedreht. Das ist
            # ein Grund zum Neuladen, kein Grund fuer 401.
            await self._laden()
        return self._schluessel.get(kid)

    async def _laden(self) -> None:
        async with netzklient() as klient:
            antwort = await klient.get(await self._jwks_url(klient))
            antwort.raise_for_status()
            dokument = _abbild(antwort.json())
        eintraege = dokument.get("keys") if dokument is not None else None
        gefunden: dict[str, Any] = {}
        if isinstance(eintraege, list):
            for roh in cast("list[object]", eintraege):
                eintrag = _abbild(roh)
                if eintrag is None:
                    continue
                kennung = _text(eintrag, "kid")
                if kennung is not None:
                    gefunden[kennung] = PyJWK(dict(eintrag)).key
        self._schluessel = gefunden
        self._geladen = datetime.now(UTC)

    async def _jwks_url(self, klient: httpx.AsyncClient) -> str:
        werte = einstellungen()
        try:
            antwort = await klient.get(werte.discovery_url)
            antwort.raise_for_status()
            dokument = _abbild(antwort.json())
            uri = _text(dokument, "jwks_uri") if dokument is not None else None
        except (httpx.HTTPError, ValueError):
            # Authentik liefert die Schluessel auch ohne Discovery unter jwks/.
            return werte.jwks_url
        return uri if uri is not None else werte.jwks_url


_speicher = JwksSpeicher()

_bearer = HTTPBearer(auto_error=False)


async def nutzer_aus_token(token: str) -> Nutzer:
    """Prueft ein Access-Token und liefert die Person dahinter."""
    try:
        kopf = jwt.get_unverified_header(token)
    except PyJWTError as fehler:
        raise AnmeldungFehlt("Das Token ist nicht lesbar.") from fehler

    kid = _text(kopf, "kid")
    if kid is None:
        raise AnmeldungFehlt("Dem Token fehlt die Schluesselkennung.")

    schluessel = await _speicher.schluessel(kid)
    if schluessel is None:
        raise AnmeldungFehlt("Der Schluessel des Tokens ist unbekannt.")

    werte = einstellungen()
    try:
        daten: Mapping[str, object] = jwt.decode(
            token,
            schluessel,
            algorithms=ALGORITHMEN,
            audience=werte.oidc_client_id,
            issuer=werte.oidc_issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except PyJWTError as fehler:
        raise AnmeldungFehlt("Das Token ist ungueltig.") from fehler

    # ``require`` und die Pruefung in PyJWT lassen nur ein Token mit sub als
    # Zeichenkette durch. Eine eigene Pruefung darauf waere unerreichbar.
    return Nutzer(sub=str(daten["sub"]), email=_text(daten, "email"), name=_text(daten, "name"))


async def nutzer_optional(
    anmeldung: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Nutzer | None:
    """Liefert die Person, falls ein Token dabei ist. Ein falsches Token bleibt ein Fehler."""
    if anmeldung is None:
        return None
    return await nutzer_aus_token(anmeldung.credentials)


async def aktueller_nutzer(
    nutzer: Annotated[Nutzer | None, Depends(nutzer_optional)],
) -> Nutzer:
    """Liefert die angemeldete Person. Ohne Token endet die Anfrage mit 401."""
    if nutzer is None:
        raise AnmeldungFehlt("Fuer diesen Zugriff ist eine Anmeldung noetig.")
    return nutzer
