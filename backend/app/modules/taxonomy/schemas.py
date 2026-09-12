"""Vertrag der Taxonomieseiten.

Eine Seite zeigt beides. Die aeussere Einordnung ist der Pfad nach oben bis zur
Wurzel und die Geschwister auf derselben Stufe. Die innere sind die Taxa eine
Stufe darunter und die Arten, die unmittelbar an dieser Stufe haengen.
"""

from pydantic import Field

from app.modules.species.schemas import SpeciesBrief
from app.shared.schemas import TaxonStep


class TaxonChild(TaxonStep):
    """Ein Taxon eine Stufe tiefer, mit allen Arten unter ihm gezaehlt."""

    species_count: int = Field(validation_alias="artenZahl", serialization_alias="artenZahl")


class TaxonPage(TaxonStep):
    """Eine Stufe der Einordnung mit ihren Nachbarn, Kindern und Arten."""

    description: str | None = Field(
        validation_alias="beschreibung", serialization_alias="beschreibung"
    )
    # Die Wurzel zuerst, das Taxon selbst steht nicht darin.
    path: list[TaxonStep] = Field(validation_alias="pfad", serialization_alias="pfad")
    siblings: list[TaxonStep] = Field(
        validation_alias="geschwister", serialization_alias="geschwister"
    )
    children: list[TaxonChild] = Field(validation_alias="kinder", serialization_alias="kinder")
    # Nur die Arten, die an genau dieser Stufe haengen. Was tiefer haengt, steht
    # in der Zahl am Kind.
    species: list[SpeciesBrief] = Field(validation_alias="arten", serialization_alias="arten")
    species_count: int = Field(validation_alias="artenZahl", serialization_alias="artenZahl")
