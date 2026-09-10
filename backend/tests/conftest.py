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
from app.core.settings import get_settings
from app.main import build_app
from app.models import Base
from app.modules.species.router import current_catalog
from tests.objects import catalog_for_tests

ISSUER = "https://sso.example.test/application/o/pilze/"
CLIENT_ID = "pilze"


def rsa_key() -> rsa.RSAPrivateKey:
    """Erzeugt einen RSA-Schluessel fuer einen Test."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def ec_key() -> ec.EllipticCurvePrivateKey:
    """Erzeugt einen EC-Schluessel fuer einen Test."""
    return ec.generate_private_key(ec.SECP256R1())


def _jwk(privat: Any, kid: str, alg: str) -> dict[str, Any]:  # noqa: ANN401
    algorithm = (
        ECAlgorithm(ECAlgorithm.SHA256) if alg == "ES256" else RSAAlgorithm(RSAAlgorithm.SHA256)
    )
    data = dict(algorithm.to_jwk(privat.public_key(), as_dict=True))
    data.update({"kid": kid, "alg": alg, "use": "sig"})
    return data


@dataclass
class FakeIdp:
    """Ein Issuer, den der Test in der Hand hat."""

    key: Any = field(default_factory=rsa_key)
    kid: str = "schluessel-1"
    alg: str = "RS256"
    discovery: dict[str, Any] | None = None
    jwks: Any = None
    calls: list[str] = field(default_factory=list[str])

    def __post_init__(self) -> None:
        self.rotate(self.key, self.kid, self.alg)

    def rotate(self, key: Any, kid: str, alg: str = "RS256") -> None:  # noqa: ANN401
        """Setzt den Signaturschluessel neu, so wie ein Issuer ihn dreht."""
        self.key = key
        self.kid = kid
        self.alg = alg
        self.jwks = {"keys": [_jwk(key, kid, alg), {"kty": "oct", "k": "ohne-kid"}]}
        self.discovery = {"issuer": ISSUER, "jwks_uri": f"{ISSUER}jwks/"}

    def token(
        self,
        *,
        key: Any = None,  # noqa: ANN401
        kid: str | None = None,
        alg: str | None = None,
        ohne_kid: bool = False,
        **claims: Any,  # noqa: ANN401
    ) -> str:
        """Stellt ein Access-Token aus. Jeder Anspruch laesst sich ueberschreiben."""
        utc_now = datetime.now(UTC)
        payload: dict[str, Any] = {
            "iss": ISSUER,
            "aud": CLIENT_ID,
            "sub": "nutzer-1",
            "email": "pilz@example.test",
            "name": "Pilzsammlerin",
            "iat": int(utc_now.timestamp()),
            "exp": int((utc_now + timedelta(hours=1)).timestamp()),
        }
        payload.update(claims)
        return jwt.encode(
            payload,
            key if key is not None else self.key,
            algorithm=alg or self.alg,
            headers={} if ohne_kid else {"kid": kid or self.kid},
        )

    def response(self, request_for: httpx.Request) -> httpx.Response:
        """Beantwortet Discovery und JWKS."""
        path = str(request_for.url)
        self.calls.append(path)
        if path.endswith(".well-known/openid-configuration"):
            if self.discovery is None:
                return httpx.Response(404, json={"detail": "unbekannt"})
            return httpx.Response(200, json=self.discovery)
        return httpx.Response(200, json=self.jwks)


@pytest.fixture(autouse=True)
def environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> Iterator[None]:  # noqa: ANN401
    """Setzt PILZE_* auf Testwerte und leert die Zwischenspeicher des Prozesses."""
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{tmp_path}/pilze.sqlite")
    monkeypatch.setenv("PILZE_FOTOS", str(tmp_path / "fotos"))
    monkeypatch.setenv("PILZE_MAPS", str(tmp_path / "maps"))
    monkeypatch.setenv("PILZE_OIDC_ISSUER", ISSUER)
    monkeypatch.setenv("PILZE_OIDC_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("PILZE_ORIGIN", "http://localhost:4200")
    get_settings.cache_clear()
    db.engine.cache_clear()
    db.session_factory.cache_clear()
    yield
    get_settings.cache_clear()
    db.engine.cache_clear()
    db.session_factory.cache_clear()


@pytest.fixture
def idp(monkeypatch: pytest.MonkeyPatch) -> FakeIdp:
    """Haengt den falschen Issuer an die Stelle des echten Netzes."""
    fake = FakeIdp()
    monkeypatch.setattr(auth, "net_client", _client_factory(fake))
    monkeypatch.setattr(auth, "_cache", auth.JwksCache())
    return fake


def _client_factory(fake: FakeIdp) -> Callable[[], httpx.AsyncClient]:
    def build() -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(fake.response))

    return build


def auth_header(token: str) -> Mapping[str, str]:
    """Baut die Authorization-Kopfzeile zu einem Token."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def schema() -> AsyncIterator[None]:
    """Legt das Schema in der SQLite-Datei des Tests an."""
    engine_of_process = db.engine()
    async with engine_of_process.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    await engine_of_process.dispose()


@pytest.fixture
def object_app(schema: None) -> FastAPI:  # noqa: ARG001
    """Die App mit Schema und dem Katalog der Tests statt dem der Dateien."""
    built = build_app()
    built.dependency_overrides[current_catalog] = catalog_for_tests
    return built


@pytest.fixture
def call(object_app: FastAPI) -> httpx.AsyncClient:
    """Ein Klient gegen die App, ohne Netz."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=object_app),
        base_url="http://test",
    )
