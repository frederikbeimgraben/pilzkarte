"""Die Bild-Pipeline: verkleinern, EXIF und GPS entfernen, Fremdformate abweisen."""

import io
from pathlib import Path

import pytest
from PIL import Image

from app.core.errors import MedientypFalsch
from app.shared import bilder
from tests.objekte import bild, bild_mit_exif, hat_exif


def test_die_vorlage_traegt_wirklich_exif_und_gps() -> None:
    # Ohne diese Behauptung wuerde der Test unten auch dann gruen, wenn Pillow
    # gar keine Kopfzeilen geschrieben haette.
    rohdaten = bild_mit_exif()
    kopfzeilen = Image.open(io.BytesIO(rohdaten)).getexif()

    assert hat_exif(rohdaten) is True
    assert kopfzeilen[0x010F] == "TestKamera"
    assert kopfzeilen.get_ifd(0x8825)[2] == (48.0, 31.0, 12.0)


def test_ein_grosses_bild_wird_auf_1600_px_verkleinert() -> None:
    daten, breite, hoehe = bilder.verkleinern(bild_mit_exif(2400, 1200))

    assert (breite, hoehe) == (bilder.KANTE, 800)
    assert Image.open(io.BytesIO(daten)).size == (bilder.KANTE, 800)


def test_ein_kleines_bild_bleibt_wie_es_ist() -> None:
    _, breite, hoehe = bilder.verkleinern(bild("JPEG", 400, 300))

    assert (breite, hoehe) == (400, 300)


def test_nach_dem_verkleinern_sind_exif_und_gps_weg() -> None:
    daten, _, _ = bilder.verkleinern(bild_mit_exif())
    gelesen = Image.open(io.BytesIO(daten))

    assert hat_exif(daten) is False
    assert dict(gelesen.getexif()) == {}
    assert gelesen.info.get("exif") is None


def test_webp_kommt_als_jpeg_zurueck() -> None:
    daten, _, _ = bilder.verkleinern(bild("WEBP"))

    assert Image.open(io.BytesIO(daten)).format == "JPEG"


def test_ein_png_ist_kein_erlaubtes_format() -> None:
    with pytest.raises(MedientypFalsch, match="JPEG und WebP"):
        _ = bilder.verkleinern(bild("PNG"))


def test_eine_datei_ohne_bild_wird_abgewiesen() -> None:
    with pytest.raises(MedientypFalsch, match="kein lesbares Bild"):
        _ = bilder.verkleinern(b"das ist kein Bild")


def test_ein_zu_grosses_bild_wird_abgewiesen() -> None:
    with pytest.raises(MedientypFalsch, match="12 MB"):
        _ = bilder.verkleinern(b"x" * (bilder.HOECHSTGROESSE + 1))


def test_eine_fehlende_datei_zu_loeschen_ist_kein_fehler(tmp_path: Path) -> None:
    bilder.entfernen(tmp_path / "gibt-es-nicht.jpg")
