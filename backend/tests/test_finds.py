"""Funde, Fotos und die geteilte Karte.

Der Besitzer kommt aus dem Token. Jede Route bekommt darum einen Test mit einem
zweiten Konto, und jeder dieser Tests erwartet 404, nie 403.
"""

from typing import Any

import httpx
import pytest
from PIL import Image

from app.shared.geometry import KM_PER_LAT_DEGREE
from tests.conftest import FakeIdp, auth_header
from tests.objects import (
    FIND_PLACE,
    find_body,
    has_exif,
    image,
    image_with_exif,
    photo_folder,
    tomorrow,
    yesterday,
)

OWN = "nutzer-1"
OTHER = "nutzer-2"


def as_user(idp: FakeIdp, sub: str = OWN, name: str = "Frederik") -> dict[str, str]:
    """Die Kopfzeile eines Kontos."""
    return dict(auth_header(idp.token(sub=sub, name=name)))


async def create_find(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    sub: str = OWN,
    **override: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt einen Fund an und liefert die Antwort."""
    response = await call.post("/api/funde", json=find_body(**override), headers=as_user(idp, sub))
    assert response.status_code == 201, response.text
    return response.json()


async def attach_photo(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    find_id: str,
    data: bytes | None = None,
    typ: str = "image/jpeg",
    sub: str = OWN,
) -> httpx.Response:
    """Haengt ein Foto an einen Fund."""
    return await call.post(
        f"/api/funde/{find_id}/fotos",
        files={"datei": ("fund.jpg", data if data is not None else image_with_exif(), typ)},
        headers=as_user(idp, sub),
    )


# ------------------------------------------------------------------ Anlegen und Lesen


async def test_without_a_token_there_are_no_finds(call: httpx.AsyncClient) -> None:
    async with call:
        response = await call.get("/api/funde")

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_a_find_carries_the_owner_from_the_token(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        read_back = await call.get(f"/api/funde/{created['id']}", headers=as_user(idp))

    assert read_back.status_code == 200
    assert read_back.json()["artSlug"] == "steinpilz"
    assert read_back.json()["fotos"] == []
    # Die Vorgabe ist nein: ein Fund geht nicht von allein in das Training.
    assert read_back.json()["fuerTraining"] is False
    # Der Besitzer verlaesst den Dienst nie.
    assert "besitzerSub" not in read_back.json()


async def test_the_listing_shows_only_own_finds(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp)
        _ = await create_find(call, idp, sub=OTHER)
        mine = await call.get("/api/funde", headers=as_user(idp))

    assert mine.json()["gesamt"] == 1


async def test_the_listing_pages(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        for tag in range(3):
            _ = await create_find(call, idp, count=tag + 1)
        page = await call.get("/api/funde?limit=2&offset=2", headers=as_user(idp))

    body = page.json()
    assert body["gesamt"] == 3
    assert body["limit"] == 2
    assert body["offset"] == 2
    assert len(body["eintraege"]) == 1


async def test_an_impossible_limit_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.get("/api/funde?limit=0", headers=as_user(idp))

    assert response.status_code == 422


# ------------------------------------------------------------------ Validierung


@pytest.mark.parametrize(
    ("override", "grund"),
    [
        pytest.param({"lat": 40.0}, "lat", id="zu-weit-sued"),
        pytest.param({"lat": 60.0}, "lat", id="zu-weit-nord"),
        pytest.param({"lon": 2.0}, "lon", id="zu-weit-west"),
        pytest.param({"lon": 20.0}, "lon", id="zu-weit-ost"),
        pytest.param({"anzahl": 0}, "anzahl", id="anzahl-null"),
    ],
)
async def test_input_outside_the_rules(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    override: dict[str, Any],
    grund: str,
) -> None:
    async with call:
        response = await call.post(
            "/api/funde",
            json=find_body(**override),
            headers=as_user(idp),
        )

    assert response.status_code == 422
    assert any(error["field"] == grund for error in response.json()["errors"])


async def test_a_date_in_the_future_is_no_find(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.post(
            "/api/funde",
            json=find_body(found_on=tomorrow()),
            headers=as_user(idp),
        )

    assert response.status_code == 422
    assert "Zukunft" in response.text


async def test_a_species_outside_the_catalog_is_no_find(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.post(
            "/api/funde",
            json=find_body(artSlug="knollenblaetterpilz"),
            headers=as_user(idp),
        )

    assert response.status_code == 422
    assert "steht nicht im Katalog" in response.json()["detail"]


async def test_an_unknown_field_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.post(
            "/api/funde",
            json=find_body(besitzerSub="jemand-anderes"),
            headers=as_user(idp),
        )

    assert response.status_code == 422


# ------------------------------------------------------------------ Aendern und Loeschen


async def test_patch_sets_only_the_sent_fields(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        patched = await call.patch(
            f"/api/funde/{created['id']}",
            json={"anzahl": 7, "sichtbarkeit": "geteilt"},
            headers=as_user(idp),
        )

    body = patched.json()
    assert body["anzahl"] == 7
    assert body["sichtbarkeit"] == "geteilt"
    assert body["notiz"] == created["notiz"]


async def test_the_training_release_can_be_set_and_taken_back(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp, fuerTraining=True)
        back = await call.patch(
            f"/api/funde/{created['id']}",
            json={"fuerTraining": False},
            headers=as_user(idp),
        )

    assert created["fuerTraining"] is True
    assert back.json()["fuerTraining"] is False


async def test_a_note_can_be_cleared(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_find(call, idp)
        patched = await call.patch(
            f"/api/funde/{created['id']}",
            json={"notiz": None},
            headers=as_user(idp),
        )

    assert patched.json()["notiz"] is None


async def test_patch_checks_the_new_species(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_find(call, idp)
        response = await call.patch(
            f"/api/funde/{created['id']}",
            json={"artSlug": "gibt-es-nicht"},
            headers=as_user(idp),
        )

    assert response.status_code == 422


async def test_delete_clears_the_find_and_its_photos(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        _ = await attach_photo(call, idp, created["id"])
        folder = photo_folder() / created["id"]
        assert folder.is_dir()

        deleted = await call.delete(f"/api/funde/{created['id']}", headers=as_user(idp))
        afterwards = await call.get(f"/api/funde/{created['id']}", headers=as_user(idp))

    assert deleted.status_code == 204
    assert afterwards.status_code == 404
    assert not folder.exists()


# ------------------------------------------------------------------ Besitz


@pytest.mark.parametrize(
    ("verb", "anhang"),
    [
        pytest.param("get", "", id="lesen"),
        pytest.param("patch", "", id="aendern"),
        pytest.param("delete", "", id="loeschen"),
        pytest.param("post", "/fotos", id="foto-anhaengen"),
    ],
)
async def test_another_persons_find_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    verb: str,
    anhang: str,
) -> None:
    async with call:
        created = await create_find(call, idp)
        path = f"/api/funde/{created['id']}{anhang}"
        if verb == "post":
            response = await attach_photo(call, idp, created["id"], sub=OTHER)
        elif verb == "patch":
            response = await call.patch(path, json={"anzahl": 1}, headers=as_user(idp, OTHER))
        else:
            response = await call.request(verb.upper(), path, headers=as_user(idp, OTHER))

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_an_unknown_id_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.get("/api/funde/gibt-es-nicht", headers=as_user(idp))

    assert response.status_code == 404


# ------------------------------------------------------------------ Fotos


async def test_a_photo_reaches_the_disk_without_exif_and_gps(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        response = await attach_photo(call, idp, created["id"])

    assert response.status_code == 201
    body = response.json()
    assert (body["breite"], body["hoehe"]) == (1600, 800)

    file = photo_folder() / created["id"] / f"{body['id']}.jpg"
    raw_bytes = file.read_bytes()
    read_back = Image.open(file)
    assert has_exif(raw_bytes) is False
    assert dict(read_back.getexif()) == {}
    assert read_back.size == (1600, 800)


async def test_at_most_three_photos_per_find(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_find(call, idp)
        for _ in range(3):
            assert (await attach_photo(call, idp, created["id"])).status_code == 201
        fourth = await attach_photo(call, idp, created["id"])
        read_back = await call.get(f"/api/funde/{created['id']}", headers=as_user(idp))

    assert fourth.status_code == 409
    assert "hoechstens 3" in fourth.json()["detail"]
    assert len(read_back.json()["fotos"]) == 3


@pytest.mark.parametrize(
    ("data", "typ"),
    [
        pytest.param(None, "application/pdf", id="falscher-medientyp"),
        pytest.param(b"kein Bild", "image/jpeg", id="kein-bild"),
    ],
)
async def test_a_foreign_format_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    data: bytes | None,
    typ: str,
) -> None:
    async with call:
        created = await create_find(call, idp)
        response = await attach_photo(call, idp, created["id"], data=data, typ=typ)

    assert response.status_code == 415
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_a_png_with_a_jpeg_header_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        response = await attach_photo(call, idp, created["id"], data=image("PNG"))

    assert response.status_code == 415


async def test_the_owner_gets_the_image_file(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        photo = (await attach_photo(call, idp, created["id"])).json()
        response = await call.get(
            f"/api/funde/{created['id']}/fotos/{photo['id']}",
            headers=as_user(idp),
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"


async def test_a_shared_find_hands_out_its_photo_to_others(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp, visibility="geteilt")
        photo = (await attach_photo(call, idp, created["id"])).json()
        response = await call.get(
            f"/api/funde/{created['id']}/fotos/{photo['id']}",
            headers=as_user(idp, OTHER),
        )

    assert response.status_code == 200


async def test_a_private_find_does_not_hand_out_its_photo(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        photo = (await attach_photo(call, idp, created["id"])).json()
        response = await call.get(
            f"/api/funde/{created['id']}/fotos/{photo['id']}",
            headers=as_user(idp, OTHER),
        )

    assert response.status_code == 404


async def test_a_photo_of_another_find_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        first_one = await create_find(call, idp)
        second = await create_find(call, idp)
        photo = (await attach_photo(call, idp, first_one["id"])).json()
        response = await call.get(
            f"/api/funde/{second['id']}/fotos/{photo['id']}",
            headers=as_user(idp),
        )
        missing = await call.get(
            f"/api/funde/{first_one['id']}/fotos/gibt-es-nicht", headers=as_user(idp)
        )

    assert response.status_code == 404
    assert missing.status_code == 404


async def test_a_find_without_an_id_has_no_photo(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.get("/api/funde/gibt-es-nicht/fotos/auch-nicht", headers=as_user(idp))

    assert response.status_code == 404


async def test_a_photo_can_be_deleted(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    async with call:
        created = await create_find(call, idp)
        photo = (await attach_photo(call, idp, created["id"])).json()
        file = photo_folder() / created["id"] / f"{photo['id']}.jpg"

        deleted = await call.delete(
            f"/api/funde/{created['id']}/fotos/{photo['id']}",
            headers=as_user(idp),
        )
        read_back = await call.get(f"/api/funde/{created['id']}", headers=as_user(idp))

    assert deleted.status_code == 204
    assert not file.exists()
    assert read_back.json()["fotos"] == []


async def test_another_persons_photo_cannot_be_deleted(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)
        photo = (await attach_photo(call, idp, created["id"])).json()
        response = await call.delete(
            f"/api/funde/{created['id']}/fotos/{photo['id']}",
            headers=as_user(idp, OTHER),
        )

    assert response.status_code == 404


# ------------------------------------------------------------------ Geteilte Funde


@pytest.mark.parametrize("species", ["steinpilz", "pfifferling"])
async def test_a_shared_find_of_a_protected_species_never_leaves_exact(
    call: httpx.AsyncClient,
    idp: FakeIdp,
    species: str,
) -> None:
    async with call:
        _ = await create_find(call, idp, artSlug=species, visibility="geteilt")
        shared = await call.get("/api/funde/geteilt", headers=as_user(idp, OTHER))

    entry = shared.json()["eintraege"][0]
    assert entry["gerundet"] is True
    assert (entry["lat"], entry["lon"]) != (FIND_PLACE["lat"], FIND_PLACE["lon"])
    # Die Gegend stimmt: weiter als eine halbe Masche kann es nicht sein.
    half_cell = 5.0 / KM_PER_LAT_DEGREE / 2 + 1e-6
    assert abs(entry["lat"] - FIND_PLACE["lat"]) <= half_cell
    assert entry["melder"] == "Frederik"
    assert entry["eigen"] is False


async def test_an_unprotected_species_stays_exact(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, artSlug="parasol", visibility="geteilt")
        shared = await call.get("/api/funde/geteilt", headers=as_user(idp, OTHER))

    entry = shared.json()["eintraege"][0]
    assert entry["gerundet"] is False
    assert (entry["lat"], entry["lon"]) == (FIND_PLACE["lat"], FIND_PLACE["lon"])


async def test_an_own_find_stays_exact_even_when_protected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, visibility="geteilt")
        shared = await call.get("/api/funde/geteilt", headers=as_user(idp))

    entry = shared.json()["eintraege"][0]
    assert entry["gerundet"] is False
    assert entry["eigen"] is True
    assert (entry["lat"], entry["lon"]) == (FIND_PLACE["lat"], FIND_PLACE["lon"])


async def test_a_private_find_never_shows_up_as_shared(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp)
        shared = await call.get("/api/funde/geteilt", headers=as_user(idp, OTHER))

    assert shared.json()["gesamt"] == 0


async def test_the_box_narrows_the_shared_finds(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, artSlug="parasol", visibility="geteilt")
        inside = await call.get(
            "/api/funde/geteilt?bbox=9.0,48.4,9.2,48.6",
            headers=as_user(idp, OTHER),
        )
        outside = await call.get(
            "/api/funde/geteilt?bbox=11.0,50.0,11.2,50.2",
            headers=as_user(idp, OTHER),
        )

    assert inside.json()["gesamt"] == 1
    assert outside.json()["gesamt"] == 0


async def test_a_rounded_find_is_filtered_after_rounding(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, visibility="geteilt")
        open_ring = await call.get("/api/funde/geteilt", headers=as_user(idp, OTHER))
        coarse = open_ring.json()["eintraege"][0]
        # Ein Ausschnitt um den genauen Ort, aber ohne den gerundeten Knoten:
        # der Fund darf darin nicht auftauchen.
        narrow = (
            f"bbox={FIND_PLACE['lon'] - 0.001},{FIND_PLACE['lat'] - 0.001},"
            f"{FIND_PLACE['lon'] + 0.001},{FIND_PLACE['lat'] + 0.001}"
        )
        response = await call.get(f"/api/funde/geteilt?{narrow}", headers=as_user(idp, OTHER))

    assert (coarse["lat"], coarse["lon"]) != (FIND_PLACE["lat"], FIND_PLACE["lon"])
    assert response.json()["gesamt"] == 0


async def test_shared_finds_are_readable_without_an_account(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, artSlug="parasol", visibility="geteilt")
        anonymous = await call.get("/api/funde/geteilt")

    entry = anonymous.json()["eintraege"][0]
    assert anonymous.status_code == 200
    # Ohne Konto gehoert kein Fund dem Aufrufer.
    assert entry["eigen"] is False
    assert entry["melder"] == "Frederik"
    assert (entry["lat"], entry["lon"]) == (FIND_PLACE["lat"], FIND_PLACE["lon"])


async def test_without_an_account_a_protected_species_stays_rounded(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, visibility="geteilt")
        anonymous = await call.get("/api/funde/geteilt")
        with_account = await call.get("/api/funde/geteilt", headers=as_user(idp, OTHER))

    ohne = anonymous.json()["eintraege"][0]
    other = with_account.json()["eintraege"][0]
    assert ohne["gerundet"] is True
    assert (ohne["lat"], ohne["lon"]) != (FIND_PLACE["lat"], FIND_PLACE["lon"])
    # Ohne Konto und mit fremdem Konto ist die Antwort dieselbe.
    assert (ohne["lat"], ohne["lon"]) == (other["lat"], other["lon"])


async def test_a_wrong_token_stays_an_error_here_too(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        _ = await create_find(call, idp, visibility="geteilt")
        response = await call.get(
            "/api/funde/geteilt",
            headers={"Authorization": "Bearer kein-echtes-token"},
        )

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_a_broken_box_is_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        response = await call.get("/api/funde/geteilt?bbox=9.0,48.4", headers=as_user(idp))
        anonymous = await call.get("/api/funde/geteilt?bbox=9.0,48.4")

    assert response.status_code == 422
    assert anonymous.status_code == 422
    assert "vier Zahlen" in response.json()["detail"]


async def test_shared_finds_show_the_photo_count(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp, artSlug="parasol", visibility="geteilt")
        _ = await attach_photo(call, idp, created["id"])
        shared = await call.get("/api/funde/geteilt", headers=as_user(idp, OTHER))

    assert shared.json()["eintraege"][0]["fotos"] == 1


async def test_a_find_from_yesterday_carries_its_date(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    async with call:
        created = await create_find(call, idp)

    assert created["datum"] == yesterday()
