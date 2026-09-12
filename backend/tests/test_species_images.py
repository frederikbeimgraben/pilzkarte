"""Bilder zu Arten: ablegen, sehen, einreichen und pruefen.

Die Vorrichtung baut drei Konten: eine Person mit der Admin-Gruppe im Token,
eine mit dem Recht zu pruefen und eine ohne alles. An ihnen laesst sich jede
Regel einzeln pruefen.
"""

from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from app.core.db import session_factory
from app.core.settings import get_settings
from app.models import SpeciesImage
from app.modules.access.permissions import Permission
from app.modules.access.service import ensure_built_in_roles, sync_permissions
from app.modules.species.schemas import ProtectionStatus
from app.modules.species_images.service import MAX_BYTES
from app.shared.geometry import GRID_KM, to_grid
from app.shared.images import EDGES, Size
from app.shared.schemas import ImageState, Licence
from tests.conftest import FakeIdp, auth_header
from tests.objects import catalog_for_tests, has_exif, image, image_with_exif

ADMIN_GROUP = "pilze-admins"
ROOT = "nutzer-root"
REVIEWER = "nutzer-pruefer"
GUEST = "nutzer-gast"


def as_root(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines Kontos mit der Admin-Gruppe im Token."""
    return dict(auth_header(idp.token(sub=ROOT, name="Frederik", groups=[ADMIN_GROUP])))


def as_reviewer(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines Kontos, dem eine Rolle das Pruefen gibt."""
    return dict(auth_header(idp.token(sub=REVIEWER, name="Marie", email="marie@example.test")))


def as_guest(idp: FakeIdp) -> dict[str, str]:
    """Die Kopfzeile eines Kontos ohne jedes Recht."""
    return dict(auth_header(idp.token(sub=GUEST, name="Jonas", email="jonas@example.test")))


@pytest.fixture
async def seeded(schema: None) -> None:  # noqa: ARG001
    """Legt Rechtekatalog und feste Rollen an, so wie der Start es tut."""
    async with session_factory()() as session:
        await sync_permissions(session)
        await ensure_built_in_roles(session)


@pytest.fixture
def call(object_app: FastAPI, seeded: None) -> httpx.AsyncClient:  # noqa: ARG001
    """Ein Klient gegen die App mit fertigem Rechtekatalog."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=object_app),
        base_url="http://test",
    )


async def give_review_right(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    """Gibt dem Pruefer eine Rolle, die nur das Recht zum Pruefen traegt."""
    role = await call.post(
        "/api/roles",
        json={
            "slug": "reviewer",
            "name": "Pruefer",
            "permissions": [Permission.IMAGE_REVIEW.value],
        },
        headers=as_root(idp),
    )
    assert role.status_code == 201
    # Die Person muss dem Dienst bekannt sein, bevor sie eine Rolle bekommt.
    assert (await call.get("/api/ich", headers=as_reviewer(idp))).status_code == 200
    given = await call.put(
        f"/api/people/{REVIEWER}/roles",
        json={"roles": [role.json()["id"]]},
        headers=as_root(idp),
    )
    assert given.status_code == 200


def metadata(**override: Any) -> dict[str, str]:  # noqa: ANN401
    """Die Formularfelder neben der Datei."""
    body: dict[str, str] = {
        "speciesSlug": "steinpilz",
        "photographer": "Frederik Beimgraben",
        "licence": Licence.CC_BY_SA_4.value,
    }
    body.update({name: str(value) for name, value in override.items()})
    return body


async def upload(
    call: httpx.AsyncClient,
    headers: dict[str, str],
    *,
    path: str = "/api/species-images",
    data: bytes | None = None,
    media_type: str = "image/jpeg",
    **override: Any,  # noqa: ANN401
) -> httpx.Response:
    """Laedt ein Bild hoch, samt Herkunft."""
    return await call.post(
        path,
        data=metadata(**override),
        files={"file": ("art.jpg", data if data is not None else image_with_exif(), media_type)},
        headers=headers,
    )


async def published(call: httpx.AsyncClient, idp: FakeIdp, **override: Any) -> dict[str, Any]:  # noqa: ANN401
    """Ein Bild, das schon an der Art steht."""
    response = await upload(call, as_root(idp), **override)
    assert response.status_code == 201, response.text
    return response.json()


async def submitted(call: httpx.AsyncClient, idp: FakeIdp, **override: Any) -> dict[str, Any]:  # noqa: ANN401
    """Ein Bild, das noch auf die Pruefung wartet."""
    response = await upload(
        call,
        as_guest(idp),
        path="/api/species-images/submissions",
        **override,
    )
    assert response.status_code == 201, response.text
    return response.json()


def species_folder(slug: str = "steinpilz") -> Path:
    """Der Ordner, in dem die Bilder einer Art liegen."""
    return get_settings().species_images / slug


# ------------------------------------------------------------------ Ablegen


async def test_an_upload_lands_on_the_disk_in_every_size(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    names = {file.name for file in species_folder().iterdir()}
    assert names == {f"{body['id']}-{size.value}.jpg" for size in Size}


async def test_the_small_version_is_smaller_than_the_large_one(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    large = (species_folder() / f"{body['id']}-{Size.FULL.value}.jpg").stat().st_size
    small = (species_folder() / f"{body['id']}-{Size.THUMB.value}.jpg").stat().st_size
    assert small < large


async def test_the_stored_image_carries_no_camera_headers(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    for size in Size:
        assert not has_exif((species_folder() / f"{body['id']}-{size.value}.jpg").read_bytes())


async def test_a_large_image_is_scaled_to_the_long_edge(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    assert body["width"] == EDGES[Size.FULL]
    assert body["height"] == EDGES[Size.FULL] // 2


async def test_the_answer_names_the_path_of_both_versions(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    assert body["url"] == f"/api/species-images/{body['id']}/full"
    assert body["thumbUrl"] == f"/api/species-images/{body['id']}/thumb"


async def test_a_file_that_is_not_a_photo_is_refused(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    response = await upload(call, as_root(idp), data=image("PNG"), media_type="image/png")

    assert response.status_code == 415
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_an_image_above_three_megabytes_is_refused(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    # Der Medientyp stimmt, die Datei ist nur zu gross. Der Dienst darf sie
    # gar nicht erst oeffnen.
    response = await upload(call, as_root(idp), data=b"\xff\xd8\xff" + b"0" * MAX_BYTES)

    assert response.status_code == 415
    assert "3 MB" in response.json()["detail"]


async def test_an_unknown_species_is_refused(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    response = await upload(call, as_root(idp), speciesSlug="mondpilz")

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


# ------------------------------------------------------------------ Pflichtfelder


async def test_without_a_photographer_nothing_is_stored(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    response = await call.post(
        "/api/species-images",
        data={"speciesSlug": "steinpilz", "licence": Licence.OWN.value},
        files={"file": ("art.jpg", image_with_exif(), "image/jpeg")},
        headers=as_root(idp),
    )

    assert response.status_code == 422
    assert "photographer" in {error["field"] for error in response.json()["errors"]}
    assert not species_folder().exists()


async def test_without_a_licence_nothing_is_stored(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    response = await call.post(
        "/api/species-images",
        data={"speciesSlug": "steinpilz", "photographer": "Frederik"},
        files={"file": ("art.jpg", image_with_exif(), "image/jpeg")},
        headers=as_root(idp),
    )

    assert response.status_code == 422
    assert "licence" in {error["field"] for error in response.json()["errors"]}


async def test_a_photographer_of_blanks_is_no_photographer(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    response = await upload(call, as_root(idp), photographer="   ")

    assert response.status_code == 422


async def test_a_licence_outside_the_list_is_refused(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    response = await upload(call, as_root(idp), licence="frei")

    assert response.status_code == 422


async def test_the_optional_fields_reach_the_answer(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(
        call,
        idp,
        source="https://example.test/bild",
        takenOn="2026-09-06",
        caption="Junges Exemplar",
    )

    assert body["source"] == "https://example.test/bild"
    assert body["takenOn"] == "2026-09-06"
    assert body["caption"] == "Junges Exemplar"


async def test_an_empty_optional_field_becomes_nothing(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp, source="", caption="  ")

    assert body["source"] is None
    assert body["caption"] is None


# ------------------------------------------------------------------ Rechte


async def test_without_the_right_no_image_is_published(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    response = await upload(call, as_guest(idp))

    assert response.status_code == 403
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_without_a_token_no_image_is_published(call: httpx.AsyncClient) -> None:
    response = await call.post(
        "/api/species-images",
        data=metadata(),
        files={"file": ("art.jpg", image_with_exif(), "image/jpeg")},
    )

    assert response.status_code == 401


async def test_without_the_right_nothing_is_reviewed(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)

    approval = await call.post(
        f"/api/species-images/{body['id']}/approval",
        headers=as_guest(idp),
    )
    rejection = await call.post(
        f"/api/species-images/{body['id']}/rejection",
        json={"reason": "Unscharf."},
        headers=as_guest(idp),
    )
    inbox = await call.get("/api/species-images/submissions", headers=as_guest(idp))

    assert [approval.status_code, rejection.status_code, inbox.status_code] == [403, 403, 403]


async def test_without_the_right_nothing_is_changed_or_deleted(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    patched = await call.patch(
        f"/api/species-images/{body['id']}",
        json={"caption": "Fremd"},
        headers=as_guest(idp),
    )
    deleted = await call.delete(f"/api/species-images/{body['id']}", headers=as_guest(idp))

    assert [patched.status_code, deleted.status_code] == [403, 403]


async def test_the_right_to_review_is_not_the_right_to_publish(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    await give_review_right(call, idp)

    response = await upload(call, as_reviewer(idp))

    assert response.status_code == 403


# ------------------------------------------------------------------ Sichtbarkeit


async def test_a_submitted_image_is_in_no_public_answer(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)

    listed = await call.get("/api/species-images", params={"species": "steinpilz"})
    single = await call.get(f"/api/species-images/{body['id']}")
    file = await call.get(f"/api/species-images/{body['id']}/full")

    assert listed.json() == []
    assert [single.status_code, file.status_code] == [404, 404]


async def test_a_submitted_image_is_seen_by_the_person_who_sent_it(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)

    single = await call.get(f"/api/species-images/{body['id']}", headers=as_guest(idp))
    file = await call.get(f"/api/species-images/{body['id']}/full", headers=as_guest(idp))

    assert single.status_code == 200
    assert single.json()["state"] == ImageState.SUBMITTED.value
    assert file.status_code == 200


async def test_a_submitted_image_is_hidden_from_another_account(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    await give_review_right(call, idp)
    body = await submitted(call, idp)
    other = dict(auth_header(idp.token(sub="nutzer-fremd", name="Fremde")))

    hidden = await call.get(f"/api/species-images/{body['id']}", headers=other)
    seen = await call.get(f"/api/species-images/{body['id']}", headers=as_reviewer(idp))

    assert hidden.status_code == 404
    assert seen.status_code == 200


async def test_an_approved_image_is_read_without_an_account(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    listed = await call.get("/api/species-images", params={"species": "steinpilz"})
    file = await call.get(f"/api/species-images/{body['id']}/thumb")

    assert [entry["id"] for entry in listed.json()] == [body["id"]]
    assert file.status_code == 200
    assert file.headers["content-type"] == "image/jpeg"


async def test_the_list_holds_only_the_asked_species(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    await published(call, idp, speciesSlug="steinpilz")
    await published(call, idp, speciesSlug="parasol")

    listed = await call.get("/api/species-images", params={"species": "parasol"})

    assert [entry["speciesSlug"] for entry in listed.json()] == ["parasol"]


async def test_an_unknown_image_is_not_found(call: httpx.AsyncClient) -> None:
    response = await call.get("/api/species-images/gibt-es-nicht")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_a_size_outside_the_list_is_refused(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    body = await published(call, idp)

    response = await call.get(f"/api/species-images/{body['id']}/riesig")

    assert response.status_code == 422


async def test_a_missing_file_on_the_disk_is_not_found(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)
    (species_folder() / f"{body['id']}-{Size.THUMB.value}.jpg").unlink()

    response = await call.get(f"/api/species-images/{body['id']}/thumb")

    assert response.status_code == 404


# ------------------------------------------------------------------ Pruefen


async def test_an_approved_image_becomes_public(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    body = await submitted(call, idp)

    approved = await call.post(
        f"/api/species-images/{body['id']}/approval",
        headers=as_root(idp),
    )
    listed = await call.get("/api/species-images", params={"species": "steinpilz"})

    assert approved.json()["state"] == ImageState.APPROVED.value
    assert [entry["id"] for entry in listed.json()] == [body["id"]]


async def test_a_rejection_without_a_reason_does_not_go_out(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)

    empty = await call.post(
        f"/api/species-images/{body['id']}/rejection",
        json={},
        headers=as_root(idp),
    )
    blank = await call.post(
        f"/api/species-images/{body['id']}/rejection",
        json={"reason": "   "},
        headers=as_root(idp),
    )
    after = await call.get(f"/api/species-images/{body['id']}", headers=as_root(idp))

    assert [empty.status_code, blank.status_code] == [422, 422]
    assert empty.headers["content-type"].startswith("application/problem+json")
    assert after.json()["state"] == ImageState.SUBMITTED.value


async def test_the_person_who_sent_it_sees_state_and_reason(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)

    _ = await call.post(
        f"/api/species-images/{body['id']}/rejection",
        json={"reason": "Unscharf, die Roehren sind nicht zu erkennen."},
        headers=as_root(idp),
    )
    mine = await call.get("/api/species-images/mine", headers=as_guest(idp))

    entry = mine.json()["eintraege"][0]
    assert entry["state"] == ImageState.REJECTED.value
    assert entry["rejectReason"] == "Unscharf, die Roehren sind nicht zu erkennen."


async def test_an_approval_clears_an_earlier_reason(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)
    _ = await call.post(
        f"/api/species-images/{body['id']}/rejection",
        json={"reason": "Unscharf."},
        headers=as_root(idp),
    )

    approved = await call.post(
        f"/api/species-images/{body['id']}/approval",
        headers=as_root(idp),
    )

    assert approved.json()["rejectReason"] is None


async def test_the_inbox_holds_the_open_submissions_oldest_first(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    await give_review_right(call, idp)
    first = await submitted(call, idp, caption="Zuerst")
    second = await submitted(call, idp, caption="Danach")
    await published(call, idp)

    inbox = await call.get("/api/species-images/submissions", headers=as_reviewer(idp))

    body = inbox.json()
    assert [entry["id"] for entry in body["eintraege"]] == [first["id"], second["id"]]
    assert body["gesamt"] == 2


async def test_the_inbox_names_the_person_who_sent_the_image(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    await give_review_right(call, idp)
    await submitted(call, idp)

    inbox = await call.get("/api/species-images/submissions", headers=as_reviewer(idp))

    assert inbox.json()["eintraege"][0]["submittedBy"] == "Jonas"


async def test_the_inbox_also_shows_what_was_rejected(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)
    _ = await call.post(
        f"/api/species-images/{body['id']}/rejection",
        json={"reason": "Unscharf."},
        headers=as_root(idp),
    )

    inbox = await call.get(
        "/api/species-images/submissions",
        params={"state": ImageState.REJECTED.value},
        headers=as_root(idp),
    )

    assert [entry["id"] for entry in inbox.json()["eintraege"]] == [body["id"]]


async def test_mine_holds_only_the_own_images(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    own = await submitted(call, idp)
    await published(call, idp)

    mine = await call.get("/api/species-images/mine", headers=as_guest(idp))

    assert [entry["id"] for entry in mine.json()["eintraege"]] == [own["id"]]


async def test_mine_needs_an_account(call: httpx.AsyncClient) -> None:
    response = await call.get("/api/species-images/mine")

    assert response.status_code == 401


# ------------------------------------------------------------------ Titelbild


async def test_the_lead_image_leads_the_list(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    await published(call, idp, caption="Zuerst hochgeladen")
    lead = await published(call, idp, caption="Spaeter, aber Titelbild", lead="true")

    listed = await call.get("/api/species-images", params={"species": "steinpilz"})

    assert next(entry["id"] for entry in listed.json()) == lead["id"]


async def test_only_one_image_of_a_species_is_the_lead(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    first = await published(call, idp, lead="true")
    second = await published(call, idp, lead="true")

    listed = await call.get("/api/species-images", params={"species": "steinpilz"})

    leads = {entry["id"]: entry["lead"] for entry in listed.json()}
    assert leads == {first["id"]: False, second["id"]: True}


async def test_a_submission_is_no_lead_image_yet(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    body = await submitted(call, idp, lead="true")

    assert body["lead"] is False


async def test_a_rejected_image_loses_the_lead(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    body = await published(call, idp, lead="true")

    rejected = await call.post(
        f"/api/species-images/{body['id']}/rejection",
        json={"reason": "Rechte unklar."},
        headers=as_root(idp),
    )

    assert rejected.json()["lead"] is False


async def test_the_lead_moves_with_a_patch(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    first = await published(call, idp, lead="true")
    second = await published(call, idp)

    _ = await call.patch(
        f"/api/species-images/{second['id']}",
        json={"lead": True},
        headers=as_root(idp),
    )
    listed = await call.get("/api/species-images", params={"species": "steinpilz"})

    leads = {entry["id"]: entry["lead"] for entry in listed.json()}
    assert leads == {first["id"]: False, second["id"]: True}


async def test_an_unapproved_image_cannot_be_the_lead(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)

    response = await call.patch(
        f"/api/species-images/{body['id']}",
        json={"lead": True},
        headers=as_root(idp),
    )

    assert response.status_code == 409


# ------------------------------------------------------------------ Aendern und loeschen


async def test_a_patch_changes_only_what_it_names(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    body = await published(call, idp, caption="Alt")

    patched = await call.patch(
        f"/api/species-images/{body['id']}",
        json={"caption": "Neu"},
        headers=as_root(idp),
    )

    assert patched.json()["caption"] == "Neu"
    assert patched.json()["photographer"] == body["photographer"]


async def test_a_patch_cannot_empty_the_provenance(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    without_name = await call.patch(
        f"/api/species-images/{body['id']}",
        json={"photographer": None},
        headers=as_root(idp),
    )
    without_licence = await call.patch(
        f"/api/species-images/{body['id']}",
        json={"licence": None},
        headers=as_root(idp),
    )

    assert [without_name.status_code, without_licence.status_code] == [422, 422]


async def test_a_deleted_image_takes_its_files_with_it(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp)

    response = await call.delete(f"/api/species-images/{body['id']}", headers=as_root(idp))

    assert response.status_code == 204
    assert list(species_folder().iterdir()) == []


async def test_a_person_takes_back_the_own_submission(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await submitted(call, idp)

    response = await call.delete(f"/api/species-images/{body['id']}", headers=as_guest(idp))

    assert response.status_code == 204


async def test_a_foreign_submission_stays(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    await give_review_right(call, idp)
    body = await submitted(call, idp)

    response = await call.delete(f"/api/species-images/{body['id']}", headers=as_reviewer(idp))

    assert response.status_code == 403


async def test_an_empty_inbox_is_an_empty_page(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    mine = await call.get("/api/species-images/mine", headers=as_guest(idp))

    assert mine.json() == {"eintraege": [], "gesamt": 0, "limit": 50, "offset": 0}


# ------------------------------------------------------------------ Ort


# Eine Stelle im Schoenbuch. Sie liegt sicher in Deutschland und laesst sich
# gegen ihren Rasterknoten nachrechnen.
PLACE = {"lat": 48.5203, "lon": 9.0511}


async def stored(image_id: str) -> SpeciesImage:
    """Liest die Zeile aus der Datenbank, an der Antwort vorbei."""
    async with session_factory()() as session:
        row = await session.get(SpeciesImage, image_id)
        assert row is not None
        return row


async def test_the_exact_place_never_reaches_the_database(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp, **PLACE)

    row = await stored(body["id"])
    assert (row.lon, row.lat) == to_grid((PLACE["lon"], PLACE["lat"]), GRID_KM)
    assert row.lat != PLACE["lat"]
    assert row.lon != PLACE["lon"]


async def test_the_answer_carries_the_place_on_the_grid(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp, **PLACE)

    lon, lat = to_grid((PLACE["lon"], PLACE["lat"]), GRID_KM)
    assert (body["lon"], body["lat"]) == (lon, lat)


async def test_a_place_is_optional(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    body = await published(call, idp)

    row = await stored(body["id"])
    assert (body["lat"], body["lon"]) == (None, None)
    assert (row.lat, row.lon) == (None, None)


async def test_half_a_place_is_no_place(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    only_lat = await upload(call, as_root(idp), lat=PLACE["lat"])
    only_lon = await upload(call, as_root(idp), lon=PLACE["lon"])

    assert [only_lat.status_code, only_lon.status_code] == [422, 422]
    assert only_lat.headers["content-type"].startswith("application/problem+json")


async def test_a_strictly_protected_species_takes_no_place(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    response = await upload(
        call,
        as_root(idp),
        speciesSlug="kaiserling",
        lat=PLACE["lat"],
        lon=PLACE["lon"],
    )

    assert response.status_code == 422
    assert "streng" in response.json()["detail"]


async def test_a_strictly_protected_species_takes_an_image_without_a_place(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    body = await published(call, idp, speciesSlug="kaiserling")

    assert body["lat"] is None


async def test_a_submission_rounds_its_place_too(call: httpx.AsyncClient, idp: FakeIdp) -> None:
    body = await submitted(call, idp, **PLACE)

    row = await stored(body["id"])
    assert (row.lon, row.lat) == to_grid((PLACE["lon"], PLACE["lat"]), GRID_KM)


async def test_a_place_outside_germany_is_refused(
    call: httpx.AsyncClient,
    idp: FakeIdp,
) -> None:
    response = await upload(call, as_root(idp), lat=0.0, lon=0.0)

    assert response.status_code == 422


def test_an_unknown_species_counts_as_strictly_protected() -> None:
    # Im Zweifel geht gar kein Ort heraus. Die Route weist einen unbekannten
    # Slug schon vorher ab; diese Regel traegt den Fall, falls sie es einmal
    # nicht tut.
    assert catalog_for_tests().protection_of("gibtsnicht") is ProtectionStatus.STRICT
