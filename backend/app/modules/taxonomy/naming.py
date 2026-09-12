"""Wie ein lateinischer Name zu einem Slug wird und welche Gattung er nennt.

Die Regel steht ein zweites Mal in ``modell/src/pilze/taxonomy_fetch.py``. Die
Kette laeuft in einer eigenen Umgebung und liegt nicht auf der Paketliste des
Dienstes, darum laesst sie sich nicht importieren. Aendert sich die Regel,
aendern sich beide Stellen; ein Test haelt sie gegen ``daten/taxonomie.json``
zusammen.
"""

import re
import unicodedata


def genus_of(latin_name: str) -> str:
    """Die Gattung eines lateinischen Namens: sein erstes Wort."""
    return latin_name.split(maxsplit=1)[0]


def taxon_slug(latin_name: str) -> str:
    """Der Slug eines lateinischen Namens: klein, ASCII, Woerter mit Bindestrich."""
    plain = unicodedata.normalize("NFKD", latin_name).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")


def genus_slug_of(latin_name: str) -> str:
    """Der Slug der Gattung, unter der eine Art mit diesem Namen haengt."""
    return taxon_slug(genus_of(latin_name))
