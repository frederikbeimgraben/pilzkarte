"""Version der App."""

import tomllib
from pathlib import Path
from typing import Final

# Der Dienst installiert kein Paket, darum liefert importlib.metadata nichts.
# Die pyproject.toml liegt neben dem Code und ist die einzige Quelle der Version.
_PYPROJECT: Final = Path(__file__).resolve().parents[2] / "pyproject.toml"


def read_version() -> str:
    """Liest die Version aus der pyproject.toml."""
    with _PYPROJECT.open("rb") as file:
        project = tomllib.load(file)["project"]
    return str(project["version"])


VERSION: Final = read_version()
