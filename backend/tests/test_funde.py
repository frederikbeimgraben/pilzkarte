"""Funde, Fotos und die geteilte Karte.

Der Besitzer kommt aus dem Token. Jede Route bekommt darum einen Test mit einem
zweiten Konto, und jeder dieser Tests erwartet 404, nie 403.
"""

from typing import Any

import httpx
import pytest
from PIL import Image

from app.shared.geometrie import KM_JE_BREITENGRAD
from tests.conftest import FalscherIdp, kopfzeile
from tests.objekte import (
    FUNDORT,
    bild,
    bild_mit_exif,
    fotos_ordner,
    fund_koerper,
    gestern,
    hat_exif,
    morgen,
)

EIGEN = "nutzer-1"
FREMD = "nutzer-2"


def als(idp: FalscherIdp, sub: str = EIGEN, name: str = "Frederik") -> dict[str, str]:
    """Die Kopfzeile eines Kontos."""
    return dict(kopfzeile(idp.token(sub=sub, name=name)))


async def fund_anlegen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    sub: str = EIGEN,
    **abweichung: Any,  # noqa: ANN401
) -> dict[str, Any]:
    """Legt einen Fund an und liefert die Antwort."""
    antwort = await ruf.post("/api/funde", json=fund_koerper(**abweichung), headers=als(idp, sub))
    assert antwort.status_code == 201, antwort.text
    return antwort.json()


async def foto_anhaengen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    fund_id: str,
    daten: bytes | None = None,
    typ: str = "image/jpeg",
    sub: str = EIGEN,
) -> httpx.Response:
    """Haengt ein Foto an einen Fund."""
    return await ruf.post(
        f"/api/funde/{fund_id}/fotos",
        files={"datei": ("fund.jpg", daten if daten is not None else bild_mit_exif(), typ)},
        headers=als(idp, sub),
    )


# ------------------------------------------------------------------ Anlegen und Lesen


async def test_ohne_token_gibt_es_keine_funde(ruf: httpx.AsyncClient) -> None:
    async with ruf:
        antwort = await ruf.get("/api/funde")

    assert antwort.status_code == 401
    assert antwort.headers["content-type"].startswith("application/problem+json")


async def test_ein_fund_traegt_den_besitzer_aus_dem_token(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        gelesen = await ruf.get(f"/api/funde/{angelegt['id']}", headers=als(idp))

    assert gelesen.status_code == 200
    assert gelesen.json()["artSlug"] == "steinpilz"
    assert gelesen.json()["fotos"] == []
    # Der Besitzer verlaesst den Dienst nie.
    assert "besitzerSub" not in gelesen.json()


async def test_die_liste_zeigt_nur_die_eigenen_funde(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp)
        _ = await fund_anlegen(ruf, idp, sub=FREMD)
        meine = await ruf.get("/api/funde", headers=als(idp))

    assert meine.json()["gesamt"] == 1


async def test_die_liste_blaettert(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        for tag in range(3):
            _ = await fund_anlegen(ruf, idp, anzahl=tag + 1)
        seite = await ruf.get("/api/funde?limit=2&offset=2", headers=als(idp))

    koerper = seite.json()
    assert koerper["gesamt"] == 3
    assert koerper["limit"] == 2
    assert koerper["offset"] == 2
    assert len(koerper["eintraege"]) == 1


async def test_ein_unmoegliches_limit_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.get("/api/funde?limit=0", headers=als(idp))

    assert antwort.status_code == 422


# ------------------------------------------------------------------ Validierung


@pytest.mark.parametrize(
    ("abweichung", "grund"),
    [
        pytest.param({"lat": 40.0}, "lat", id="zu-weit-sued"),
        pytest.param({"lat": 60.0}, "lat", id="zu-weit-nord"),
        pytest.param({"lon": 2.0}, "lon", id="zu-weit-west"),
        pytest.param({"lon": 20.0}, "lon", id="zu-weit-ost"),
        pytest.param({"anzahl": 0}, "anzahl", id="anzahl-null"),
    ],
)
async def test_eingaben_ausserhalb_der_regeln(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    abweichung: dict[str, Any],
    grund: str,
) -> None:
    async with ruf:
        antwort = await ruf.post(
            "/api/funde",
            json=fund_koerper(**abweichung),
            headers=als(idp),
        )

    assert antwort.status_code == 422
    assert any(fehler["field"] == grund for fehler in antwort.json()["errors"])


async def test_ein_datum_in_der_zukunft_ist_kein_fund(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.post(
            "/api/funde",
            json=fund_koerper(datum=morgen()),
            headers=als(idp),
        )

    assert antwort.status_code == 422
    assert "Zukunft" in antwort.text


async def test_eine_art_ausserhalb_des_katalogs_ist_kein_fund(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.post(
            "/api/funde",
            json=fund_koerper(artSlug="knollenblaetterpilz"),
            headers=als(idp),
        )

    assert antwort.status_code == 422
    assert "steht nicht im Katalog" in antwort.json()["detail"]


async def test_ein_fremdes_feld_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.post(
            "/api/funde",
            json=fund_koerper(besitzerSub="jemand-anderes"),
            headers=als(idp),
        )

    assert antwort.status_code == 422


# ------------------------------------------------------------------ Aendern und Loeschen


async def test_aendern_setzt_nur_die_gesendeten_felder(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        geaendert = await ruf.patch(
            f"/api/funde/{angelegt['id']}",
            json={"anzahl": 7, "sichtbarkeit": "geteilt"},
            headers=als(idp),
        )

    koerper = geaendert.json()
    assert koerper["anzahl"] == 7
    assert koerper["sichtbarkeit"] == "geteilt"
    assert koerper["notiz"] == angelegt["notiz"]


async def test_eine_notiz_laesst_sich_leeren(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        geaendert = await ruf.patch(
            f"/api/funde/{angelegt['id']}",
            json={"notiz": None},
            headers=als(idp),
        )

    assert geaendert.json()["notiz"] is None


async def test_aendern_prueft_die_neue_art(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        antwort = await ruf.patch(
            f"/api/funde/{angelegt['id']}",
            json={"artSlug": "gibt-es-nicht"},
            headers=als(idp),
        )

    assert antwort.status_code == 422


async def test_loeschen_raeumt_den_fund_und_seine_fotos(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        _ = await foto_anhaengen(ruf, idp, angelegt["id"])
        ordner = fotos_ordner() / angelegt["id"]
        assert ordner.is_dir()

        geloescht = await ruf.delete(f"/api/funde/{angelegt['id']}", headers=als(idp))
        nachher = await ruf.get(f"/api/funde/{angelegt['id']}", headers=als(idp))

    assert geloescht.status_code == 204
    assert nachher.status_code == 404
    assert not ordner.exists()


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
async def test_ein_fremder_fund_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    verb: str,
    anhang: str,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        pfad = f"/api/funde/{angelegt['id']}{anhang}"
        if verb == "post":
            antwort = await foto_anhaengen(ruf, idp, angelegt["id"], sub=FREMD)
        elif verb == "patch":
            antwort = await ruf.patch(pfad, json={"anzahl": 1}, headers=als(idp, FREMD))
        else:
            antwort = await ruf.request(verb.upper(), pfad, headers=als(idp, FREMD))

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "not_found"


async def test_eine_unbekannte_kennung_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.get("/api/funde/gibt-es-nicht", headers=als(idp))

    assert antwort.status_code == 404


# ------------------------------------------------------------------ Fotos


async def test_ein_foto_kommt_ohne_exif_und_gps_auf_die_platte(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        antwort = await foto_anhaengen(ruf, idp, angelegt["id"])

    assert antwort.status_code == 201
    koerper = antwort.json()
    assert (koerper["breite"], koerper["hoehe"]) == (1600, 800)

    datei = fotos_ordner() / angelegt["id"] / f"{koerper['id']}.jpg"
    rohdaten = datei.read_bytes()
    gelesen = Image.open(datei)
    assert hat_exif(rohdaten) is False
    assert dict(gelesen.getexif()) == {}
    assert gelesen.size == (1600, 800)


async def test_hoechstens_drei_fotos_je_fund(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        for _ in range(3):
            assert (await foto_anhaengen(ruf, idp, angelegt["id"])).status_code == 201
        viertes = await foto_anhaengen(ruf, idp, angelegt["id"])
        gelesen = await ruf.get(f"/api/funde/{angelegt['id']}", headers=als(idp))

    assert viertes.status_code == 409
    assert "hoechstens 3" in viertes.json()["detail"]
    assert len(gelesen.json()["fotos"]) == 3


@pytest.mark.parametrize(
    ("daten", "typ"),
    [
        pytest.param(None, "application/pdf", id="falscher-medientyp"),
        pytest.param(b"kein Bild", "image/jpeg", id="kein-bild"),
    ],
)
async def test_ein_fremdes_format_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    daten: bytes | None,
    typ: str,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        antwort = await foto_anhaengen(ruf, idp, angelegt["id"], daten=daten, typ=typ)

    assert antwort.status_code == 415
    assert antwort.headers["content-type"].startswith("application/problem+json")


async def test_ein_png_mit_jpeg_kopfzeile_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        antwort = await foto_anhaengen(ruf, idp, angelegt["id"], daten=bild("PNG"))

    assert antwort.status_code == 415


async def test_der_besitzer_bekommt_seine_bilddatei(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        foto = (await foto_anhaengen(ruf, idp, angelegt["id"])).json()
        antwort = await ruf.get(
            f"/api/funde/{angelegt['id']}/fotos/{foto['id']}",
            headers=als(idp),
        )

    assert antwort.status_code == 200
    assert antwort.headers["content-type"] == "image/jpeg"


async def test_ein_geteilter_fund_gibt_sein_foto_auch_fremd_heraus(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp, sichtbarkeit="geteilt")
        foto = (await foto_anhaengen(ruf, idp, angelegt["id"])).json()
        antwort = await ruf.get(
            f"/api/funde/{angelegt['id']}/fotos/{foto['id']}",
            headers=als(idp, FREMD),
        )

    assert antwort.status_code == 200


async def test_ein_privater_fund_gibt_sein_foto_nicht_heraus(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        foto = (await foto_anhaengen(ruf, idp, angelegt["id"])).json()
        antwort = await ruf.get(
            f"/api/funde/{angelegt['id']}/fotos/{foto['id']}",
            headers=als(idp, FREMD),
        )

    assert antwort.status_code == 404


async def test_ein_foto_eines_anderen_fundes_ist_nicht_gefunden(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        erster = await fund_anlegen(ruf, idp)
        zweiter = await fund_anlegen(ruf, idp)
        foto = (await foto_anhaengen(ruf, idp, erster["id"])).json()
        antwort = await ruf.get(
            f"/api/funde/{zweiter['id']}/fotos/{foto['id']}",
            headers=als(idp),
        )
        fehlt = await ruf.get(f"/api/funde/{erster['id']}/fotos/gibt-es-nicht", headers=als(idp))

    assert antwort.status_code == 404
    assert fehlt.status_code == 404


async def test_ein_fund_ohne_kennung_hat_kein_foto(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.get("/api/funde/gibt-es-nicht/fotos/auch-nicht", headers=als(idp))

    assert antwort.status_code == 404


async def test_ein_foto_laesst_sich_loeschen(ruf: httpx.AsyncClient, idp: FalscherIdp) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        foto = (await foto_anhaengen(ruf, idp, angelegt["id"])).json()
        datei = fotos_ordner() / angelegt["id"] / f"{foto['id']}.jpg"

        geloescht = await ruf.delete(
            f"/api/funde/{angelegt['id']}/fotos/{foto['id']}",
            headers=als(idp),
        )
        gelesen = await ruf.get(f"/api/funde/{angelegt['id']}", headers=als(idp))

    assert geloescht.status_code == 204
    assert not datei.exists()
    assert gelesen.json()["fotos"] == []


async def test_ein_fremdes_foto_laesst_sich_nicht_loeschen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)
        foto = (await foto_anhaengen(ruf, idp, angelegt["id"])).json()
        antwort = await ruf.delete(
            f"/api/funde/{angelegt['id']}/fotos/{foto['id']}",
            headers=als(idp, FREMD),
        )

    assert antwort.status_code == 404


# ------------------------------------------------------------------ Geteilte Funde


@pytest.mark.parametrize("art", ["steinpilz", "pfifferling"])
async def test_ein_geteilter_fund_einer_geschuetzten_art_geht_nie_genau_heraus(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
    art: str,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, artSlug=art, sichtbarkeit="geteilt")
        geteilt = await ruf.get("/api/funde/geteilt", headers=als(idp, FREMD))

    eintrag = geteilt.json()["eintraege"][0]
    assert eintrag["gerundet"] is True
    assert (eintrag["lat"], eintrag["lon"]) != (FUNDORT["lat"], FUNDORT["lon"])
    # Die Gegend stimmt: weiter als eine halbe Masche kann es nicht sein.
    halbe_masche = 5.0 / KM_JE_BREITENGRAD / 2 + 1e-6
    assert abs(eintrag["lat"] - FUNDORT["lat"]) <= halbe_masche
    assert eintrag["melder"] == "Frederik"
    assert eintrag["eigen"] is False


async def test_eine_ungeschuetzte_art_bleibt_genau(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, artSlug="parasol", sichtbarkeit="geteilt")
        geteilt = await ruf.get("/api/funde/geteilt", headers=als(idp, FREMD))

    eintrag = geteilt.json()["eintraege"][0]
    assert eintrag["gerundet"] is False
    assert (eintrag["lat"], eintrag["lon"]) == (FUNDORT["lat"], FUNDORT["lon"])


async def test_der_eigene_fund_bleibt_auch_geschuetzt_genau(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, sichtbarkeit="geteilt")
        geteilt = await ruf.get("/api/funde/geteilt", headers=als(idp))

    eintrag = geteilt.json()["eintraege"][0]
    assert eintrag["gerundet"] is False
    assert eintrag["eigen"] is True
    assert (eintrag["lat"], eintrag["lon"]) == (FUNDORT["lat"], FUNDORT["lon"])


async def test_ein_privater_fund_taucht_nirgends_geteilt_auf(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp)
        geteilt = await ruf.get("/api/funde/geteilt", headers=als(idp, FREMD))

    assert geteilt.json()["gesamt"] == 0


async def test_der_ausschnitt_grenzt_die_geteilten_funde_ein(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, artSlug="parasol", sichtbarkeit="geteilt")
        drin = await ruf.get(
            "/api/funde/geteilt?bbox=9.0,48.4,9.2,48.6",
            headers=als(idp, FREMD),
        )
        draussen = await ruf.get(
            "/api/funde/geteilt?bbox=11.0,50.0,11.2,50.2",
            headers=als(idp, FREMD),
        )

    assert drin.json()["gesamt"] == 1
    assert draussen.json()["gesamt"] == 0


async def test_ein_gerundeter_fund_wird_nach_dem_runden_gefiltert(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, sichtbarkeit="geteilt")
        offen = await ruf.get("/api/funde/geteilt", headers=als(idp, FREMD))
        grob = offen.json()["eintraege"][0]
        # Ein Ausschnitt um den genauen Ort, aber ohne den gerundeten Knoten:
        # der Fund darf darin nicht auftauchen.
        eng = (
            f"bbox={FUNDORT['lon'] - 0.001},{FUNDORT['lat'] - 0.001},"
            f"{FUNDORT['lon'] + 0.001},{FUNDORT['lat'] + 0.001}"
        )
        antwort = await ruf.get(f"/api/funde/geteilt?{eng}", headers=als(idp, FREMD))

    assert (grob["lat"], grob["lon"]) != (FUNDORT["lat"], FUNDORT["lon"])
    assert antwort.json()["gesamt"] == 0


async def test_geteilte_funde_liest_auch_wer_kein_konto_hat(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, artSlug="parasol", sichtbarkeit="geteilt")
        ohne_konto = await ruf.get("/api/funde/geteilt")

    eintrag = ohne_konto.json()["eintraege"][0]
    assert ohne_konto.status_code == 200
    # Ohne Konto gehoert kein Fund dem Aufrufer.
    assert eintrag["eigen"] is False
    assert eintrag["melder"] == "Frederik"
    assert (eintrag["lat"], eintrag["lon"]) == (FUNDORT["lat"], FUNDORT["lon"])


async def test_ohne_konto_bleibt_eine_geschuetzte_art_gerundet(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, sichtbarkeit="geteilt")
        ohne_konto = await ruf.get("/api/funde/geteilt")
        mit_konto = await ruf.get("/api/funde/geteilt", headers=als(idp, FREMD))

    ohne = ohne_konto.json()["eintraege"][0]
    fremd = mit_konto.json()["eintraege"][0]
    assert ohne["gerundet"] is True
    assert (ohne["lat"], ohne["lon"]) != (FUNDORT["lat"], FUNDORT["lon"])
    # Ohne Konto und mit fremdem Konto ist die Antwort dieselbe.
    assert (ohne["lat"], ohne["lon"]) == (fremd["lat"], fremd["lon"])


async def test_ein_falsches_token_bleibt_auch_hier_ein_fehler(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        _ = await fund_anlegen(ruf, idp, sichtbarkeit="geteilt")
        antwort = await ruf.get(
            "/api/funde/geteilt",
            headers={"Authorization": "Bearer kein-echtes-token"},
        )

    assert antwort.status_code == 401
    assert antwort.headers["content-type"].startswith("application/problem+json")


async def test_ein_kaputter_ausschnitt_wird_abgewiesen(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        antwort = await ruf.get("/api/funde/geteilt?bbox=9.0,48.4", headers=als(idp))
        ohne_konto = await ruf.get("/api/funde/geteilt?bbox=9.0,48.4")

    assert antwort.status_code == 422
    assert ohne_konto.status_code == 422
    assert "vier Zahlen" in antwort.json()["detail"]


async def test_geteilte_funde_zeigen_die_zahl_der_fotos(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp, artSlug="parasol", sichtbarkeit="geteilt")
        _ = await foto_anhaengen(ruf, idp, angelegt["id"])
        geteilt = await ruf.get("/api/funde/geteilt", headers=als(idp, FREMD))

    assert geteilt.json()["eintraege"][0]["fotos"] == 1


async def test_ein_fund_von_gestern_traegt_sein_datum(
    ruf: httpx.AsyncClient,
    idp: FalscherIdp,
) -> None:
    async with ruf:
        angelegt = await fund_anlegen(ruf, idp)

    assert angelegt["datum"] == gestern()
