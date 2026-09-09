"""Endpunkte ohne Fachbezug: Gesundheit und die Konfiguration fuer das Frontend."""

from typing import Annotated

from fastapi import APIRouter, Depends

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
