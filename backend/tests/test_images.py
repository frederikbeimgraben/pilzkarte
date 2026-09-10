"""Die Bild-Pipeline: verkleinern, EXIF und GPS entfernen, Fremdformate abweisen."""

import io
from pathlib import Path

import pytest
from PIL import Image

from app.core.errors import UnsupportedMediaType
from app.shared import images
from tests.objects import has_exif, image, image_with_exif


def test_the_fixture_really_carries_exif_and_gps() -> None:
    # Ohne diese Behauptung wuerde der Test unten auch dann gruen, wenn Pillow
    # gar keine Kopfzeilen geschrieben haette.
    raw_bytes = image_with_exif()
    headers = Image.open(io.BytesIO(raw_bytes)).getexif()

    assert has_exif(raw_bytes) is True
    assert headers[0x010F] == "TestKamera"
    assert headers.get_ifd(0x8825)[2] == (48.0, 31.0, 12.0)


def test_a_large_image_is_shrunk_to_1600_px() -> None:
    data, width, height = images.shrink(image_with_exif(2400, 1200))

    assert (width, height) == (images.EDGE, 800)
    assert Image.open(io.BytesIO(data)).size == (images.EDGE, 800)


def test_a_small_image_stays_as_it_is() -> None:
    _, width, height = images.shrink(image("JPEG", 400, 300))

    assert (width, height) == (400, 300)


def test_after_shrinking_exif_and_gps_are_gone() -> None:
    data, _, _ = images.shrink(image_with_exif())
    read_back = Image.open(io.BytesIO(data))

    assert has_exif(data) is False
    assert dict(read_back.getexif()) == {}
    assert read_back.info.get("exif") is None


def test_webp_comes_back_as_jpeg() -> None:
    data, _, _ = images.shrink(image("WEBP"))

    assert Image.open(io.BytesIO(data)).format == "JPEG"


def test_a_png_is_not_an_allowed_format() -> None:
    with pytest.raises(UnsupportedMediaType, match="JPEG und WebP"):
        _ = images.shrink(image("PNG"))


def test_a_file_without_an_image_is_rejected() -> None:
    with pytest.raises(UnsupportedMediaType, match="kein lesbares Bild"):
        _ = images.shrink(b"das ist kein Bild")


def test_an_oversized_image_is_rejected() -> None:
    with pytest.raises(UnsupportedMediaType, match="12 MB"):
        _ = images.shrink(b"x" * (images.MAX_BYTES + 1))


def test_deleting_a_missing_file_is_no_error(tmp_path: Path) -> None:
    images.remove(tmp_path / "gibt-es-nicht.jpg")
