"""Schreibt den Anfangsbestand der Oberflächentexte nach ``daten/texte.json``.

Die Texte werden im Frontend geschrieben und dort auch getippt: ``de`` legt die
Schlüssel fest, ``en`` muss sie alle bedienen. Der Dienst braucht dieselben
Zeilen für die Migration, bekommt aber nur ``backend/`` auf den Server. Darum
liegt neben dem Katalog des Frontends eine Abschrift als JSON.

Der Aufruf hält beide zusammen::

    uv run python -m tools.export_texts

Ein Test vergleicht die Abschrift mit dem Katalog. Wer im Frontend einen Text
ändert und den Aufruf vergisst, sieht es in der CI.
"""

import json
import re
import sys
from pathlib import Path
from typing import Final

ROOT: Final = Path(__file__).resolve().parents[2]
SOURCE: Final = ROOT / "frontend" / "src" / "app" / "core" / "i18n" / "translations.ts"
TARGET: Final = ROOT / "backend" / "daten" / "texte.json"

# Die beiden Objektliterale des Katalogs. Ihr Kopf steht fest, ihr Ende ist die
# erste schliessende Klammer am Zeilenanfang.
BLOCKS: Final[dict[str, str]] = {
    "de": "const de = {",
    "en": "const en: Record<TranslationKey, string> = {",
}

# Ein Eintrag: Schluessel in Hochkommas, Doppelpunkt, Wert als Zeichenkette.
# Der Wert darf auf der naechsten Zeile stehen, wenn die Zeile sonst zu lang
# wuerde, und in doppelten Anfuehrungszeichen, wenn er selbst ein Hochkomma
# traegt ("Melzer's reagent").
ENTRY: Final = re.compile(
    r"""['"](?P<key>[A-Za-z0-9._]+)['"]:\s*(?P<quote>['"])(?P<value>(?:(?!(?P=quote))[^\\]|\\.)*)(?P=quote),""",
)
# Womit jeder Eintrag beginnt. Die Zahl der Anfaenge muss zur Zahl der
# gelesenen Eintraege passen, sonst hat das Muster etwas verschluckt.
START: Final = re.compile(r"""^\s{2}['"][A-Za-z0-9._]+['"]:""", re.MULTILINE)

ESCAPES: Final[dict[str, str]] = {"\\'": "'", "\\\\": "\\", "\\n": "\n", '\\"': '"'}


def unescape(value: str) -> str:
    """Macht die Fluchtzeichen einer TypeScript-Zeichenkette rueckgaengig."""
    return re.sub(r"\\.", lambda hit: ESCAPES.get(hit.group(0), hit.group(0)), value)


def block(source: str, head: str) -> str:
    """Schneidet ein Objektliteral aus der Quelle."""
    start = source.index(head) + len(head)
    end = source.index("\n}", start)
    return source[start:end]


def parse(source: str) -> dict[str, dict[str, str]]:
    """Liest beide Kataloge aus ``translations.ts``.

    Der Leser kennt genau die eine Schreibweise, die die Datei benutzt. Alles
    andere ist ein Fehler und kein stillschweigend fehlender Text.
    """
    catalogue: dict[str, dict[str, str]] = {}
    for locale, head in BLOCKS.items():
        body = block(source, head)
        entries = {hit["key"]: unescape(hit["value"]) for hit in ENTRY.finditer(body)}
        expected = len(START.findall(body))
        if len(entries) != expected:
            raise ValueError(
                f"In {locale} stehen {expected} Einträge, gelesen wurden {len(entries)}.",
            )
        catalogue[locale] = entries
    missing = set(catalogue["de"]) ^ set(catalogue["en"])
    if missing:
        raise ValueError(f"Diese Schlüssel fehlen in einer Sprache: {sorted(missing)}.")
    return catalogue


def rendered(catalogue: dict[str, dict[str, str]]) -> str:
    """Der Inhalt der Abschrift, so wie er in der Datei steht."""
    return json.dumps(catalogue, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    """Schreibt die Abschrift und meldet, ob sich etwas geaendert hat."""
    content = rendered(parse(SOURCE.read_text(encoding="utf-8")))
    if TARGET.exists() and TARGET.read_text(encoding="utf-8") == content:
        return 0
    TARGET.write_text(content, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
