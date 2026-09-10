"""Die Bezeichner des Dienstes sind englisch.

Die Regel steht in ``CLAUDE.md``. Dieser Test haelt sie fest: er liest jede
Datei unter ``app/`` und ``migrations/`` als Folge von Token und sieht sich nur
die Bezeichner an. Zeichenketten, Kommentare und Docstrings bleiben deutsch und
bleiben darum aussen vor.

Damit faellt auch nichts auf, was auf dem Draht deutsch heissen muss: ein
Feldname steht in ``Field(alias="artSlug")``, eine Spalte in
``mapped_column("art_slug", ...)``, ein Routen-Pfad in ``@router.get("/funde")``
-- alles Zeichenketten.
"""

import io
import re
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = ("app", "migrations")

# Deutsche Staemme, die im Code vorkamen. ``zone`` und ``marker`` fehlen mit
# Absicht: beide Woerter sind im Englischen dieselben.
GERMAN_STEMS = frozenset(
    {
        "aenderung",
        "anlegen",
        "anzahl",
        "art",
        "arten",
        "aufzaehlung",
        "ausschnitt",
        "bauen",
        "bedingung",
        "begehung",
        "begehungen",
        "besitz",
        "besitzer",
        "bild",
        "bilder",
        "breite",
        "daten",
        "datei",
        "dateien",
        "datum",
        "ebene",
        "ebenen",
        "eingabe",
        "einstellungen",
        "faktor",
        "faktoren",
        "farbe",
        "flaeche",
        "flaechen",
        "foto",
        "fotos",
        "fund",
        "funde",
        "geometrie",
        "geschuetzt",
        "geteilt",
        "gruppe",
        "hoehe",
        "jahr",
        "jahre",
        "kachel",
        "kacheln",
        "karte",
        "karten",
        "katalog",
        "kennung",
        "klient",
        "kombination",
        "kombinationen",
        "koerper",
        "kopf",
        "kopfzeile",
        "kopfzeilen",
        "laenge",
        "lesen",
        "loeschen",
        "merkmal",
        "merkmale",
        "mittel",
        "netz",
        "norden",
        "notiz",
        "nutzer",
        "objekte",
        "ordner",
        "osten",
        "profil",
        "pruefen",
        "punkt",
        "punkte",
        "quelle",
        "quellen",
        "raster",
        "rechteck",
        "regel",
        "saison",
        "schluessel",
        "seite",
        "seiten",
        "sichtbarkeit",
        "sitzung",
        "speisewert",
        "stand",
        "stufe",
        "stufen",
        "sueden",
        "summe",
        "alle",
        "lebenszyklus",
        "maschine",
        "migrieren",
        "objekt",
        "spalte",
        "spalten",
        "stapel",
        "tabelle",
        "tabellen",
        "treffer",
        "verbindung",
        "verweis",
        "ziel",
        "verwechslung",
        "wert",
        "werte",
        "westen",
        "woche",
        "wochen",
        "wunsch",
        "zelle",
        "zellen",
        "zonen",
    }
)

# ``ArtenListe`` zerfaellt in arten und liste, ``art_slug`` in art und slug.
SEGMENT = re.compile(r"[A-Z]+(?![a-z])|[A-Z][a-z]*|[a-z]+|[0-9]+")


def segments(name: str) -> list[str]:
    """Zerlegt einen Bezeichner in seine Woerter, egal ob camelCase oder snake_case."""
    return [part.lower() for part in SEGMENT.findall(name)]


def identifiers(path: Path) -> set[str]:
    """Jeder Bezeichner einer Datei. Zeichenketten und Kommentare bleiben draussen."""
    source = path.read_text(encoding="utf-8")
    return {
        token.string
        for token in tokenize.generate_tokens(io.StringIO(source).readline)
        if token.type == tokenize.NAME
    }


def german_identifiers() -> dict[Path, set[str]]:
    """Sucht deutsche Staemme in den Bezeichnern des Dienstes."""
    found: dict[Path, set[str]] = {}
    for folder in FOLDERS:
        for path in sorted((ROOT / folder).rglob("*.py")):
            hits = {name for name in identifiers(path) if GERMAN_STEMS.intersection(segments(name))}
            if hits:
                found[path.relative_to(ROOT)] = hits
    return found


def test_the_service_carries_no_german_identifier() -> None:
    found = german_identifiers()

    assert found == {}, "\n".join(f"{p}: {sorted(n)}" for p, n in sorted(found.items()))


def test_the_word_list_finds_a_german_identifier() -> None:
    # Ohne diese Behauptung waere der Test oben auch dann gruen, wenn die
    # Zerlegung oder die Wortliste nichts mehr faende.
    assert segments("ArtenListe") == ["arten", "liste"]
    assert GERMAN_STEMS.intersection(segments("art_slug")) == {"art"}
    assert not GERMAN_STEMS.intersection(segments("species_slug"))
