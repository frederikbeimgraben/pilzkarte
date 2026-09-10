"""Die Einstellungen und die URLs, die daran haengen."""

from pathlib import Path

import pytest

from app.core.settings import Settings, get_settings
from app.core.version import VERSION, read_version


def test_the_prefix_is_read() -> None:
    assert get_settings().oidc_client_id == "pilze"


def test_the_issuer_gets_a_trailing_slash(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PILZE_OIDC_ISSUER", "https://sso.example.test/application/o/pilze")
    get_settings.cache_clear()

    assert get_settings().oidc_issuer.endswith("/pilze/")


def test_discovery_and_jwks_hang_off_the_issuer() -> None:
    settings = Settings(oidc_issuer="https://sso.example.test/o/pilze/")

    assert (
        settings.discovery_url
        == "https://sso.example.test/o/pilze/.well-known/openid-configuration"
    )
    assert settings.jwks_url == "https://sso.example.test/o/pilze/jwks/"


def test_the_defaults_point_at_var() -> None:
    defaults = Settings.model_fields

    assert str(defaults["db"].default).startswith("sqlite+aiosqlite:///./var/")
    assert defaults["photos"].default == Path("./var/fotos")


def test_the_version_comes_from_the_file() -> None:
    assert read_version() == VERSION
