"""Die Bild-Pipeline: annehmen, verkleinern, ohne EXIF als JPEG ablegen.

Das Geraet verkleinert schon vor dem Senden. Der Dienst glaubt ihm nicht: er
rechnet das Bild neu auf, weil der Fundort der gesetzte Punkt ist und nicht der
GPS-Ort in einer Kamera-Kopfzeile.
"""

import io
from pathlib import Path
from typing import Final

from PIL import Image

from app.core.errors import MedientypFalsch

# Laengste Kante nach dem Verkleinern. Drei Fotos bleiben damit unter einem
# Megabyte, das traegt auch LTE im Wald.
KANTE: Final = 1600
QUALITAET: Final = 85

FORMATE: Final = frozenset({"JPEG", "WEBP"})
MEDIENTYPEN: Final = frozenset({"image/jpeg", "image/webp"})
ENDUNG: Final = ".jpg"

# Ein Bild aus einer Telefonkamera bleibt darunter. Alles darueber ist keine
# Aufnahme aus dem Wald.
HOECHSTGROESSE: Final = 12 * 1024 * 1024


def verkleinern(rohdaten: bytes) -> tuple[bytes, int, int]:
    """Nimmt ein JPEG oder WebP und liefert ein JPEG ohne Kopfzeilen.

    Zurueck kommen die Bytes und die Kantenlaengen des Ergebnisses. Ein Bild,
    das kleiner ist als ``KANTE``, bleibt in seiner Groesse.
    """
    if len(rohdaten) > HOECHSTGROESSE:
        raise MedientypFalsch("Das Bild ist groesser als 12 MB.")
    try:
        with Image.open(io.BytesIO(rohdaten)) as geoeffnet:
            if geoeffnet.format not in FORMATE:
                raise MedientypFalsch("Der Dienst nimmt nur JPEG und WebP an.")
            farbig = geoeffnet.convert("RGB")
    except OSError as fehler:
        raise MedientypFalsch("Die Datei ist kein lesbares Bild.") from fehler

    farbig.thumbnail((KANTE, KANTE), Image.Resampling.LANCZOS)
    # Ein neues Bild traegt keine ``info``. Nur so gehen EXIF und der GPS-Ort
    # sicher verloren, statt beim Speichern wieder mitgeschrieben zu werden.
    sauber = Image.new("RGB", farbig.size)
    sauber.paste(farbig)
    puffer = io.BytesIO()
    sauber.save(puffer, format="JPEG", quality=QUALITAET)
    return puffer.getvalue(), sauber.width, sauber.height


def ablegen(ordner: Path, dateiname: str, daten: bytes) -> Path:
    """Schreibt ein Foto in den Ordner seines Fundes."""
    ordner.mkdir(parents=True, exist_ok=True)
    ziel = ordner / dateiname
    _ = ziel.write_bytes(daten)
    return ziel


def entfernen(pfad: Path) -> None:
    """Loescht eine Fotodatei. Eine fehlende Datei ist kein Fehler."""
    pfad.unlink(missing_ok=True)
