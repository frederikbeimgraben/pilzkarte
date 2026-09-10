"""Der Rechtekatalog. Er steht im Code, nicht in der Datenbank.

Ein Recht kommt dazu, indem hier eine Zeile dazukommt. Der Dienst gleicht die
Tabelle ``permission`` beim Start damit ab, und die feste Rolle Admin trägt
jedes Recht, auch ein neues, ohne dass jemand etwas anhakt.

Der Schlüssel ist ``bereich.tätigkeit``. Der Bereich ordnet die Rechte in der
Verwaltung zu Gruppen; die Beschriftung dazu steht nicht hier, sondern in den
Oberflächentexten, damit sie übersetzbar bleibt.
"""

from enum import StrEnum
from typing import Final


class Area(StrEnum):
    """Die Gruppe, unter der ein Recht in der Verwaltung steht."""

    SPECIES = "species"
    INTERFACE = "interface"
    ACCESS = "access"
    DATA = "data"


class Permission(StrEnum):
    """Jedes Recht, das der Dienst kennt."""

    SPECIES_EDIT = "species.edit"
    SPECIES_CREATE = "species.create"
    SPECIES_DELETE = "species.delete"
    IMAGE_UPLOAD = "image.upload"
    IMAGE_REVIEW = "image.review"
    TEXT_EDIT = "text.edit"
    ROLE_MANAGE = "role.manage"
    ROLE_ASSIGN = "role.assign"
    FIND_REVIEW = "find.review"
    RUN_MANAGE = "run.manage"


AREA_OF: Final[dict[Permission, Area]] = {
    Permission.SPECIES_EDIT: Area.SPECIES,
    Permission.SPECIES_CREATE: Area.SPECIES,
    Permission.SPECIES_DELETE: Area.SPECIES,
    Permission.IMAGE_UPLOAD: Area.SPECIES,
    Permission.IMAGE_REVIEW: Area.SPECIES,
    Permission.TEXT_EDIT: Area.INTERFACE,
    Permission.ROLE_MANAGE: Area.ACCESS,
    Permission.ROLE_ASSIGN: Area.ACCESS,
    Permission.FIND_REVIEW: Area.DATA,
    Permission.RUN_MANAGE: Area.DATA,
}

# Jedes Recht des Katalogs. Admin trägt genau diese Menge.
ALL_PERMISSIONS: Final = frozenset(Permission)
