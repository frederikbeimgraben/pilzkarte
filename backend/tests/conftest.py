"""Gemeinsame Vorrichtungen der Tests.

Der falsche Issuer ersetzt Authentik: er liefert Discovery und JWKS, zaehlt die
Aufrufe und stellt Token aus. So laeuft kein Test gegen das Netz.
"""

from collections.abc import AsyncIterator, Callable, Iterator, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import FastAPI
from jwt.algorithms import ECAlgorithm, RSAAlgorithm

from app.core import auth, db
from app.core.settings import einstellungen
from app.main import app_bauen
from app.models import Base
from app.modules.arten.router import aktueller_katalog
from tests.objekte import testkatalog

ISSUER = "https://sso.example.test/application/o/pilze/"
CLIENT_ID = "pilze"


def rsa_schluessel() -> rsa.RSAPrivateKey:
    """Erzeugt einen RSA-Schluessel fuer einen Test."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def ec_schluessel() -> ec.EllipticCurvePrivateKey:
    """Erzeugt einen EC-Schluessel fuer einen Test."""
    return ec.generate_private_key(ec.SECP256R1())


def _jwk(privat: Any, kid: str, alg: str) -> dict[str, Any]:  # noqa: ANN401
    algorithmus = (
        ECAlgorithm(ECAlgorithm.SHA256) if alg == "ES256" else RSAAlgorithm(RSAAlgorithm.SHA256)
    )
    daten = dict(algorithmus.to_jwk(privat.public_key(), as_dict=True))
    daten.update({"kid": kid, "alg": alg, "use": "sig"})
    return daten


@dataclass
class FalscherIdp:
    """Ein Issuer, den der Test in der Hand hat."""

    schluessel: Any = field(default_factory=rsa_schluessel)
    kid: str = "schluessel-1"
    alg: str = "RS256"
    discovery: dict[str, Any] | None = None
    jwks: Any = None
    aufrufe: list[str] = field(default_factory=list[str])

    def __post_init__(self) -> None:
        self.drehen(self.schluessel, self.kid, self.alg)

    def drehen(self, schluessel: Any, kid: str, alg: str = "RS256") -> None:  # noqa: ANN401
        """Setzt den Signaturschluessel neu, so wie ein Issuer ihn dreht."""
        self.schluessel = schluessel
        self.kid = kid
        self.alg = alg
        self.jwks = {"keys": [_jwk(schluessel, kid, alg), {"kty": "oct", "k": "ohne-kid"}]}
        self.discovery = {"issuer": ISSUER, "jwks_uri": f"{ISSUER}jwks/"}

    def token(
        self,
        *,
        schluessel: Any = None,  # noqa: ANN401
        kid: str | None = None,
        alg: str | None = None,
        ohne_kid: bool = False,
        **ansprueche: Any,  # noqa: ANN401
    ) -> str:
        """Stellt ein Access-Token aus. Jeder Anspruch laesst sich ueberschreiben."""
        jetzt = datetime.now(UTC)
        nutzlast: dict[str, Any] = {
            "iss": ISSUER,
            "aud": CLIENT_ID,
            "sub": "nutzer-1",
            "email": "pilz@example.test",
            "name": "Pilzsammlerin",
            "iat": int(jetzt.timestamp()),
            "exp": int((jetzt + timedelta(hours=1)).timestamp()),
        }
        nutzlast.update(ansprueche)
        return jwt.encode(
            nutzlast,
            schluessel if schluessel is not None else self.schluessel,
            algorithm=alg or self.alg,
            headers={} if ohne_kid else {"kid": kid or self.kid},
        )

    def antwort(self, anfrage: httpx.Request) -> httpx.Response:
        """Beantwortet Discovery und JWKS."""
        pfad = str(anfrage.url)
        self.aufrufe.append(pfad)
        if pfad.endswith(".well-known/openid-configuration"):
            if self.discovery is None:
                return httpx.Response(404, json={"detail": "unbekannt"})
            return httpx.Response(200, json=self.discovery)
        return httpx.Response(200, json=self.jwks)


@pytest.fixture(autouse=True)
def umgebung(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> Iterator[None]:  # noqa: ANN401
    """Setzt PILZE_* auf Testwerte und leert die Zwischenspeicher des Prozesses."""
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{tmp_path}/pilze.sqlite")
    monkeypatch.setenv("PILZE_FOTOS", str(tmp_path / "fotos"))
    monkeypatch.setenv("PILZE_MAPS", str(tmp_path / "maps"))
    monkeypatch.setenv("PILZE_OIDC_ISSUER", ISSUER)
    monkeypatch.setenv("PILZE_OIDC_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("PILZE_ORIGIN", "http://localhost:4200")
    einstellungen.cache_clear()
    db.motor.cache_clear()
    db.sitzungsfabrik.cache_clear()
    yield
    einstellungen.cache_clear()
    db.motor.cache_clear()
    db.sitzungsfabrik.cache_clear()


@pytest.fixture
def idp(monkeypatch: pytest.MonkeyPatch) -> FalscherIdp:
    """Haengt den falschen Issuer an die Stelle des echten Netzes."""
    falscher = FalscherIdp()
    monkeypatch.setattr(auth, "netzklient", _klient_fabrik(falscher))
    monkeypatch.setattr(auth, "_speicher", auth.JwksSpeicher())
    return falscher


def _klient_fabrik(falscher: FalscherIdp) -> Callable[[], httpx.AsyncClient]:
    def bauen() -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(falscher.antwort))

    return bauen


def kopfzeile(token: str) -> Mapping[str, str]:
    """Baut die Authorization-Kopfzeile zu einem Token."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def schema() -> AsyncIterator[None]:
    """Legt das Schema in der SQLite-Datei des Tests an."""
    maschine = db.motor()
    async with maschine.begin() as verbindung:
        await verbindung.run_sync(Base.metadata.create_all)
    yield
    await maschine.dispose()


@pytest.fixture
def objekt_app(schema: None) -> FastAPI:  # noqa: ARG001
    """Die App mit Schema und dem Katalog der Tests statt dem der Dateien."""
    gebaut = app_bauen()
    gebaut.dependency_overrides[aktueller_katalog] = testkatalog
    return gebaut


@pytest.fixture
def ruf(objekt_app: FastAPI) -> httpx.AsyncClient:
    """Ein Klient gegen die App, ohne Netz."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=objekt_app),
        base_url="http://test",
    )
