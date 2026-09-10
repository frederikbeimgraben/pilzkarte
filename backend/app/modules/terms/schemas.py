"""Vertrag der Begriffskataloge.

Geruch, Geschmack und Baumart stehen nicht als Enum im Code, sondern als Zeilen
in der Tabelle ``begriff``. Die Verwaltung soll sie erweitern koennen, ohne dass
jemand den Dienst neu ausliefert. Die Profile nennen nur den Slug; den Namen
holt das Frontend einmal hier.
"""

from enum import StrEnum

from pydantic import Field

from app.shared.schemas import BaseSchema


class TermKind(StrEnum):
    """Welchen Katalog ein Begriff fuellt."""

    SMELL = "geruch"
    TASTE = "geschmack"
    TREE = "baum"


class Term(BaseSchema):
    """Ein Begriff: der Slug steht in den Profilen, der Name in der Oberflaeche."""

    slug: str
    name: str


class TermCatalog(BaseSchema):
    """Alle Kataloge auf einmal. Das Frontend holt sie beim Start."""

    smell: list[Term] = Field(validation_alias="geruch", serialization_alias="geruch")
    taste: list[Term] = Field(validation_alias="geschmack", serialization_alias="geschmack")
    trees: list[Term] = Field(validation_alias="baeume", serialization_alias="baeume")
