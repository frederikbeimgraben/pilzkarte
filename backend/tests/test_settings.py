"""Die Einstellungen und die URLs, die daran haengen."""

from pathlib import Path

import pytest

from app.core.settings import Einstellungen, einstellungen
from app.core.version import VERSION, version_lesen


def test_praefix_wird_gelesen() -> None:
    assert einstellungen().oidc_client_id == "pilze"


def test_issuer_bekommt_einen_schraegstrich(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PILZE_OIDC_ISSUER", "https://sso.example.test/application/o/pilze")
    einstellungen.cache_clear()

    assert einstellungen().oidc_issuer.endswith("/pilze/")


def test_discovery_und_jwks_haengen_am_issuer() -> None:
    werte = Einstellungen(oidc_issuer="https://sso.example.test/o/pilze/")

    assert (
        werte.discovery_url == "https://sso.example.test/o/pilze/.well-known/openid-configuration"
    )
    assert werte.jwks_url == "https://sso.example.test/o/pilze/jwks/"


def test_die_vorgaben_zeigen_auf_var() -> None:
    vorgaben = Einstellungen.model_fields

    assert str(vorgaben["db"].default).startswith("sqlite+aiosqlite:///./var/")
    assert vorgaben["fotos"].default == Path("./var/fotos")


def test_version_kommt_aus_der_datei() -> None:
    assert version_lesen() == VERSION
