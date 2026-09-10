"""Endpunkte ohne Fachbezug: Gesundheit, Konfiguration und die eigene Person."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import Nutzer, aktueller_nutzer
from app.core.settings import Einstellungen, einstellungen
from app.core.version import VERSION
from app.shared.schemas import BasisModell

router = APIRouter(tags=["basis"])


class Gesundheit(BasisModell):
    """Antwort des Health-Endpunkts."""

    status: str


class Konfiguration(BasisModell):
    """Was das Frontend braucht, um sich anzumelden und sich zu verorten."""

    oidc_issuer: str
    oidc_client_id: str
    origin: str
    version: str


class Ich(BasisModell):
    """Die Person hinter dem Token, so wie das Backend sie sieht."""

    sub: str
    email: str | None
    name: str | None


@router.get("/health", summary="Laeuft der Dienst?")
async def gesundheit() -> Gesundheit:
    """Meldet, dass der Dienst Anfragen annimmt."""
    return Gesundheit(status="ok")


@router.get("/config", summary="Konfiguration fuer das Frontend")
async def konfiguration(
    werte: Annotated[Einstellungen, Depends(einstellungen)],
) -> Konfiguration:
    """Liefert Issuer, Client ID, Ursprung und Version."""
    return Konfiguration(
        oidc_issuer=werte.oidc_issuer,
        oidc_client_id=werte.oidc_client_id,
        origin=werte.origin,
        version=VERSION,
    )


@router.get("/ich", summary="Wer bin ich?")
async def ich(nutzer: Annotated[Nutzer, Depends(aktueller_nutzer)]) -> Ich:
    """Liefert die Ansprueche des Tokens zurueck.

    Der Endpunkt traegt keine Fachlogik. Er ist der kuerzeste Weg, eine
    Anmeldung zu pruefen: Ohne gueltiges Token antwortet er mit 401, und das
    Frontend uebt daran seinen Weg ueber die stille Erneuerung.
    """
    return Ich(sub=nutzer.sub, email=nutzer.email, name=nutzer.name)
