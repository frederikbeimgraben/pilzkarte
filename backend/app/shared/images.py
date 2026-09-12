"""Die Bild-Pipeline: annehmen, verkleinern, ohne EXIF als JPEG ablegen.

Das Geraet verkleinert schon vor dem Senden. Der Dienst glaubt ihm nicht: er
rechnet das Bild neu auf, weil der Fundort der gesetzte Punkt ist und nicht der
GPS-Ort in einer Kamera-Kopfzeile.
"""

import io
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Final

from PIL import Image

from app.core.errors import UnsupportedMediaType

# Laengste Kante nach dem Verkleinern. Drei Fotos bleiben damit unter einem
# Megabyte, das traegt auch LTE im Wald.
EDGE: Final = 1600
QUALITY: Final = 85

FORMATS: Final = frozenset({"JPEG", "WEBP"})
MEDIA_TYPES: Final = frozenset({"image/jpeg", "image/webp"})
SUFFIX: Final = ".jpg"

# Ein Bild aus einer Telefonkamera bleibt darunter. Alles darueber ist keine
# Aufnahme aus dem Wald.
MAX_BYTES: Final = 12 * 1024 * 1024


class Size(StrEnum):
    """Die Groessen, in denen ein Bild auf der Platte liegt."""

    FULL = "full"
    THUMB = "thumb"


# Eine Artseite zeigt ein grosses Bild und darunter einen Streifen kleiner.
# Ohne die kleine Fassung laedt der Streifen viermal 1600 px, nur um sie auf
# 84 px zu zeichnen.
EDGES: Final[Mapping[Size, int]] = {Size.FULL: EDGE, Size.THUMB: 480}


@dataclass(frozen=True, slots=True)
class Rendered:
    """Eine fertige Fassung eines Bildes."""

    data: bytes
    width: int
    height: int


def _accepted(raw_bytes: bytes, max_bytes: int) -> Image.Image:
    """Prueft Groesse und Format und liefert das Bild als RGB."""
    if len(raw_bytes) > max_bytes:
        raise UnsupportedMediaType(f"Das Bild ist groesser als {max_bytes // (1024 * 1024)} MB.")
    try:
        with Image.open(io.BytesIO(raw_bytes)) as opened:
            if opened.format not in FORMATS:
                raise UnsupportedMediaType("Der Dienst nimmt nur JPEG und WebP an.")
            return opened.convert("RGB")
    except OSError as error:
        raise UnsupportedMediaType("Die Datei ist kein lesbares Bild.") from error


def _as_jpeg(source: Image.Image, edge: int) -> Rendered:
    """Rechnet ein Bild auf eine laengste Kante und schreibt es als JPEG."""
    scaled = source.copy()
    scaled.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    # Ein neues Bild traegt keine ``info``. Nur so gehen EXIF und der GPS-Ort
    # sicher verloren, statt beim Speichern wieder mitgeschrieben zu werden.
    clean = Image.new("RGB", scaled.size)
    clean.paste(scaled)
    buffer = io.BytesIO()
    clean.save(buffer, format="JPEG", quality=QUALITY)
    return Rendered(buffer.getvalue(), clean.width, clean.height)


def shrink(raw_bytes: bytes, max_bytes: int = MAX_BYTES) -> tuple[bytes, int, int]:
    """Nimmt ein JPEG oder WebP und liefert ein JPEG ohne Kopfzeilen.

    Zurueck kommen die Bytes und die Kantenlaengen des Ergebnisses. Ein Bild,
    das kleiner ist als ``EDGE``, bleibt in seiner Groesse. Die Obergrenze
    steht als Argument: ein Fundfoto kommt aus der Kamera und darf gross sein,
    ein Artbild laedt jemand am Rechner hoch und soll es nicht.
    """
    rendered = _as_jpeg(_accepted(raw_bytes, max_bytes), EDGE)
    return rendered.data, rendered.width, rendered.height


def sizes(raw_bytes: bytes, max_bytes: int = MAX_BYTES) -> dict[Size, Rendered]:
    """Liefert jede Fassung eines Bildes, gerechnet aus derselben Quelle.

    Jede Fassung aus der vorigen zu rechnen waere schneller und wuerde bei der
    kleinsten sichtbar schmieren.
    """
    source = _accepted(raw_bytes, max_bytes)
    return {size: _as_jpeg(source, edge) for size, edge in EDGES.items()}


def store(folder: Path, filename: str, data: bytes) -> Path:
    """Schreibt ein Foto in den Ordner seines Fundes."""
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / filename
    _ = target.write_bytes(data)
    return target


def remove(path: Path) -> None:
    """Loescht eine Fotodatei. Eine fehlende Datei ist kein Fehler."""
    path.unlink(missing_ok=True)
