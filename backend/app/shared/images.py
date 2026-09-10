"""Die Bild-Pipeline: annehmen, verkleinern, ohne EXIF als JPEG ablegen.

Das Geraet verkleinert schon vor dem Senden. Der Dienst glaubt ihm nicht: er
rechnet das Bild neu auf, weil der Fundort der gesetzte Punkt ist und nicht der
GPS-Ort in einer Kamera-Kopfzeile.
"""

import io
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


def shrink(raw_bytes: bytes) -> tuple[bytes, int, int]:
    """Nimmt ein JPEG oder WebP und liefert ein JPEG ohne Kopfzeilen.

    Zurueck kommen die Bytes und die Kantenlaengen des Ergebnisses. Ein Bild,
    das kleiner ist als ``KANTE``, bleibt in seiner Groesse.
    """
    if len(raw_bytes) > MAX_BYTES:
        raise UnsupportedMediaType("Das Bild ist groesser als 12 MB.")
    try:
        with Image.open(io.BytesIO(raw_bytes)) as opened:
            if opened.format not in FORMATS:
                raise UnsupportedMediaType("Der Dienst nimmt nur JPEG und WebP an.")
            colored = opened.convert("RGB")
    except OSError as error:
        raise UnsupportedMediaType("Die Datei ist kein lesbares Bild.") from error

    colored.thumbnail((EDGE, EDGE), Image.Resampling.LANCZOS)
    # Ein neues Bild traegt keine ``info``. Nur so gehen EXIF und der GPS-Ort
    # sicher verloren, statt beim Speichern wieder mitgeschrieben zu werden.
    clean = Image.new("RGB", colored.size)
    clean.paste(colored)
    buffer = io.BytesIO()
    clean.save(buffer, format="JPEG", quality=QUALITY)
    return buffer.getvalue(), clean.width, clean.height


def store(folder: Path, filename: str, data: bytes) -> Path:
    """Schreibt ein Foto in den Ordner seines Fundes."""
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / filename
    _ = target.write_bytes(data)
    return target


def remove(path: Path) -> None:
    """Loescht eine Fotodatei. Eine fehlende Datei ist kein Fehler."""
    path.unlink(missing_ok=True)
