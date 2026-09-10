"""Endpunkte ohne Fachbezug: Gesundheit, Konfiguration und die eigene Person."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import User, current_user
from app.core.settings import Settings, get_settings
from app.core.version import VERSION
from app.shared.schemas import BaseSchema

router = APIRouter(tags=["basis"])


class Health(BaseSchema):
    """Antwort des Health-Endpunkts."""

    status: str


class Config(BaseSchema):
    """Was das Frontend braucht, um sich anzumelden und sich zu verorten."""

    oidc_issuer: str
    oidc_client_id: str
    origin: str
    version: str


class Me(BaseSchema):
    """Die Person hinter dem Token, so wie das Backend sie sieht."""

    sub: str
    email: str | None
    name: str | None


@router.get("/health", summary="Laeuft der Dienst?")
async def health() -> Health:
    """Meldet, dass der Dienst Anfragen annimmt."""
    return Health(status="ok")


@router.get("/config", summary="Konfiguration fuer das Frontend")
async def configuration(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Config:
    """Liefert Issuer, Client ID, Ursprung und Version."""
    return Config(
        oidc_issuer=settings.oidc_issuer,
        oidc_client_id=settings.oidc_client_id,
        origin=settings.origin,
        version=VERSION,
    )


@router.get("/ich", summary="Wer bin ich?")
async def me(user: Annotated[User, Depends(current_user)]) -> Me:
    """Liefert die Ansprueche des Tokens zurueck.

    Der Endpunkt traegt keine Fachlogik. Er ist der kuerzeste Weg, eine
    Anmeldung zu pruefen: Ohne gueltiges Token antwortet er mit 401, und das
    Frontend uebt daran seinen Weg ueber die stille Erneuerung.
    """
    return Me(sub=user.sub, email=user.email, name=user.name)
