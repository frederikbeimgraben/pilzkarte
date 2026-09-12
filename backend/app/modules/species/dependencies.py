"""Der Katalog als Abhaengigkeit.

Er steht hier und nicht im Router: sechs Module brauchen ihn, und der Router
des Katalogs braucht seinerseits die Einordnung. Ueber den Router liefe der
Import im Kreis.
"""

from typing import Annotated

from fastapi import Depends

from app.core.settings import Settings, get_settings
from app.modules.species.catalog import DATA, Catalog, catalog


def current_catalog(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Catalog:
    """Liefert den Katalog des Prozesses. Tests haengen hier ihren eigenen ein."""
    return catalog(DATA, settings.maps)
