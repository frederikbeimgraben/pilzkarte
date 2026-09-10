"""Einstellungen aus der Umgebung.

Jede Variable traegt den Praefix ``PILZE_``. Die Liste und die Werte auf dem
Homeserver stehen in ``docs/betrieb.md``. Die Vorgaben hier zeigen auf ``./var/``
und passen zur Entwicklung auf dem eigenen Rechner.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Die Werte, die der Dienst beim Start liest."""

    model_config = SettingsConfigDict(
        env_prefix="PILZE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db: str = "sqlite+aiosqlite:///./var/pilze.sqlite"
    # Der Name der Variablen ist ein Vertrag zum NixOS-Modul. Er bleibt
    # deutsch, auch wenn das Feld englisch heisst.
    photos: Path = Field(default=Path("./var/fotos"), validation_alias="PILZE_FOTOS")
    maps: Path = Path("./var/maps")
    oidc_issuer: str = "https://sso.beimgraben.net/application/o/pilze/"
    oidc_client_id: str = "pilze"
    origin: str = "http://localhost:4200"

    @field_validator("oidc_issuer")
    @classmethod
    def _trailing_slash(cls, value: str) -> str:
        # Discovery und JWKS haengen als Pfad direkt am Issuer. Fehlt der
        # Schraegstrich, zeigt die URL auf den Elternpfad.
        return value if value.endswith("/") else value + "/"

    @property
    def discovery_url(self) -> str:
        """URL des OpenID-Configuration-Dokuments."""
        return f"{self.oidc_issuer}.well-known/openid-configuration"

    @property
    def jwks_url(self) -> str:
        """URL der Signaturschluessel, falls die Discovery keine nennt."""
        return f"{self.oidc_issuer}jwks/"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Liefert die Einstellungen des Prozesses."""
    return Settings()
