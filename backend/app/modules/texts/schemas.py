"""Vertrag der Oberflaechentexte.

Ein Eintrag traegt beide Sprachen nebeneinander: die Verwaltung zeigt sie so,
und die App baut ihr Woerterbuch in einem Zug daraus. Zwei Abrufe je Sprache
brachten nichts und kosteten einen zweiten Weg.
"""

from typing import Annotated

from pydantic import AfterValidator, Field

from app.modules.texts.seed import Locale
from app.shared.schemas import BaseSchema, Timestamp


def _not_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("Ein Text der Oberfläche darf nicht leer sein.")
    return value


TextValue = Annotated[str, Field(min_length=1, max_length=2000), AfterValidator(_not_blank)]


class TextOut(BaseSchema):
    """Ein Schluessel mit seinen Texten.

    ``changed`` sagt, ob mindestens eine Sprache von der Vorgabe abweicht. Die
    Verwaltung markiert solche Eintraege und bietet das Zuruecksetzen an.
    """

    key: str
    values: dict[Locale, str]
    changed: bool
    updated_at: Timestamp


class Catalogue(BaseSchema):
    """Der ganze Katalog. ``revision`` steht auch als ETag in der Kopfzeile."""

    revision: str
    locales: list[Locale]
    entries: list[TextOut]


class TextIn(BaseSchema):
    """Ein geaenderter Text, in genau einer Sprache."""

    locale: Locale
    value: TextValue
