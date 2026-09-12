"""Der Anfangsbestand der Oberflaechentexte.

Die Texte werden im Frontend geschrieben, in
``frontend/src/app/core/i18n/translations.ts``. Auf den Server geht aber nur
``backend/``. ``tools/export_texts.py`` schreibt darum eine Abschrift nach
``daten/texte.json``, und ein Test haelt beide zusammen.

Die Abschrift ist die Vorgabe, nicht die Wahrheit: sobald die Tabelle ``text``
steht, liest der Dienst nur noch aus ihr. Die Vorgabe bleibt trotzdem
gebraucht, denn nur gegen sie laesst sich sagen, ob ein Text geaendert wurde,
und nur aus ihr kommt er beim Zuruecksetzen zurueck.
"""

import json
from collections.abc import Mapping
from enum import StrEnum
from functools import cache
from pathlib import Path
from typing import Final


class Locale(StrEnum):
    """Die Sprachen der Oberflaeche. Deutsch fuehrt."""

    DE = "de"
    EN = "en"


SEED_FILE: Final = Path(__file__).resolve().parents[3] / "daten" / "texte.json"


@cache
def seed_catalogue() -> Mapping[Locale, Mapping[str, str]]:
    """Liest die Abschrift. Sie aendert sich im Betrieb nicht, darum nur einmal."""
    raw: dict[str, dict[str, str]] = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    return {locale: dict(raw[locale.value]) for locale in Locale}


def default_for(key: str, locale: Locale) -> str | None:
    """Die Vorgabe zu einem Schluessel, oder nichts, wenn der Katalog ihn nicht kennt."""
    return seed_catalogue()[locale].get(key)
