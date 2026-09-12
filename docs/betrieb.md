# Betrieb

Vertrag zwischen Code und NixOS-Modul `homeserver-pilze-app`. Wer eine Zeile
hier ändert, ändert auch die andere Seite.

## Hosts

| Host | Rolle |
| --- | --- |
| Server | terminiert TLS für `pilze.beimgraben.net`, leitet über WireGuard an den Homeserver. Kein Body-Limit |
| Homeserver | Caddy-Vhost auf Port 8110, nur wg0. Angular-Build und Kacheln aus `/var/www/pilze`, `/api/*` an das Backend. Rendert montags |
| Authentik | `https://sso.beimgraben.net/`, Client `pilze`, siehe `sso-authentik.md` |

## Pfade auf dem Homeserver

| Pfad | Inhalt | Schreibt |
| --- | --- | --- |
| `/var/www/pilze` | Angular-Build in der Wurzel. Kacheln `<slug>/z/x/y.png`, Manifeste `<slug>.json`, `layers.json`, `layers_kacheln/`, `funde/` | `deploy/frontend.sh`, `pilze-render` |
| `/var/www/pilze/karte` | `deutschland.pmtiles`: Vektorkacheln für Deutschland bis Zoom 14 | `tools/pmtiles/hochladen.sh` |
| `/var/lib/pilze-render` | Arbeitsbaum: `src/`, `models/`, `data/interim/` aus `modell/`, dazu `app/backend/` | `modell/deploy_daten.sh`, `deploy/backend.sh` |
| `/var/lib/pilze-app` | `pilze.sqlite`, `fotos/` | Dienst `pilze-app` |
| `/var/lib/pilze-app/fotos/arten` | Artbilder, ein Ordner je Art, je Bild eine grosse und eine kleine Fassung | Dienst `pilze-app` |

## Dienst `pilze-app`

| Punkt | Wert |
| --- | --- |
| Nutzer | `pilzeapp`. Liest Arbeitsbaum und Dokumentwurzel, schreibt nur `/var/lib/pilze-app` |
| Start | `alembic upgrade head`, dann `uvicorn app.main:app --host 127.0.0.1 --port 8111 --proxy-headers` |
| Arbeitsverzeichnis | `/var/lib/pilze-render/app/backend` |
| Startbedingung | `app/main.py` vorhanden |
| Neustart | Path-Unit `pilze-app-deploy` bei Schreiben von `app/backend/deploy.stamp` |
| Grenzen | 1 GB RAM, `ProtectSystem=strict` |

Umgebung:

| Variable | Wert auf dem Homeserver | Bedeutung |
| --- | --- | --- |
| `PILZE_DB` | `sqlite+aiosqlite:////var/lib/pilze-app/pilze.sqlite` | SQLAlchemy-URL |
| `PILZE_FOTOS` | `/var/lib/pilze-app/fotos` | Fotoablage. Ein Ordner je Fund, dazu `arten/` fuer die Artbilder |
| `PILZE_MAPS` | `/var/www/pilze` | Manifeste und Funde für Artenliste und Saisonkurve |
| `PILZE_OIDC_ISSUER` | `https://sso.beimgraben.net/application/o/pilze/` | Issuer. Discovery und JWKS folgen daraus |
| `PILZE_OIDC_CLIENT_ID` | `pilze` | erwartete `aud` im Access-Token |
| `PILZE_ADMIN_GROUP` | `pilze-admins` | Gruppe im Token. Wer sie trägt, ist Admin, auch ohne Zeile in der Datenbank |
| `PILZE_ORIGIN` | `https://pilze.beimgraben.net` | eigener Ursprung für CORS in der Entwicklung und für Links |

Lokal stehen dieselben Variablen in `backend/.env`. Vorgaben für die
Entwicklung stehen in `backend/.env.example` und zeigen auf `./var/`.

## Python-Pakete

Python 3.13 aus nixpkgs mit genau dieser Liste. Ein neues Paket heißt:
Modul ändern, Switch.

```
fastapi uvicorn sqlalchemy alembic pydantic pydantic-settings aiosqlite
pyjwt cryptography pillow httpx python-multipart
```

Entwicklung und Tests brauchen dazu `pytest`, `pytest-asyncio`, `pytest-cov`,
`ruff`, `basedpyright`. Sie stehen in `pyproject.toml` unter
`[dependency-groups] dev`, `uv sync` installiert sie von allein. Auf dem
Server wird nichts installiert.

## Caddy

- `/api/*` geht an `127.0.0.1:8111`.
- Ein Pfad, der keine Datei ist, wird auf `/index.html` umgeschrieben.
- `*.png` eine Woche immutable. `*.<hash>.js` und `*.<hash>.css` ein Jahr
  immutable. `index.html`, `*.json`, `ngsw.json`, `ngsw-worker.js` sind
  `no-cache`.
- Request-Body bis 40 MB.
- Range-Requests laufen über `file_server`. Das reicht für PMTiles.

## Deploy

rsync über Schlüssel mit erzwungenem `rrsync -wo`. Der Zielnutzer hat keine
Shell.

| Skript | Schlüssel | Ziel | Was |
| --- | --- | --- | --- |
| `deploy/frontend.sh` | `~/.ssh/pilze_deploy` | `/var/www/pilze` | Angular-Build. Filter `P /*/` und `P /*.json` schützen Kacheln, Manifeste und Ebenen vor `--delete` |
| `deploy/backend.sh` | `~/.ssh/pilze_daten` | `/var/lib/pilze-render/app/backend` | Backend. Schreibt `deploy.stamp` in einem zweiten Aufruf |
| `modell/deploy_daten.sh` | `~/.ssh/pilze_daten` | `/var/lib/pilze-render` | Kette, Modelle, Daten |
| `tools/pmtiles/hochladen.sh` | `~/.ssh/pilze_deploy` | `/var/www/pilze/karte` | PMTiles-Archiv. Ohne `--delete`, nur bei einer neuen Fassung |

Reihenfolge bei einer Änderung an beiden Seiten: erst `deploy/backend.sh`,
dann `deploy/frontend.sh`. Die Migration läuft beim Neustart des Dienstes.

## Kette und Backend-Daten

`modell/src/pilze/arten_zaehlen.py` zählt die Begehungen je Art und schreibt
die Saisontabelle nach `backend/daten/saison.json` (rund 26 kB, im Git). Aufruf
im Arbeitsbaum der Kette:
`python src/pilze/arten_zaehlen.py --tabelle ../backend/daten/saison.json`. Die
Artprofile liegen daneben als TOML unter `backend/daten/arten/`. Beides geht
mit `deploy/backend.sh` auf den Server; ohne diese Dateien startet der Dienst
nicht.

Ebenso `backend/daten/texte.json` (rund 52 kB, im Git): der Anfangsbestand der
Oberflächentexte. Geschrieben werden die Texte im Frontend, in
`frontend/src/app/core/i18n/translations.ts`; auf den Server geht aber nur
`backend/`. `cd backend && uv run python -m tools.export_texts` hält die
Abschrift auf Stand, ein Test in `be-test` prüft das. Aus ihr füllt die
Migration die Tabelle `text`, und der Start zieht jeden neuen Schlüssel nach.

In der Gegenrichtung holt `modell/update.sh` die Funde, die jemand in der App
für das Training freigegeben hat: `GET /api/intern/training-funde` nach
`modell/data/raw/app/funde.json`, gelesen von `build_occurrences.py`. Der
Endpunkt braucht kein Token und antwortet **nur** direkt am Port
(`http://127.0.0.1:8111`). Über den Vhost liefert er 404, weil Caddy dabei
`X-Forwarded-For` setzt. Die Liste trägt den genauen Fundort und darf den
Rechner darum nicht verlassen. Läuft das Backend nicht, geht `update.sh`
weiter und rechnet mit GBIF allein. Die Adresse steht in `APP_FUNDE` und lässt
sich für einen Testlauf überschreiben.

## Lokale Entwicklung

- Umgebung: `nix develop` bringt beide Seiten mit, `nix develop .#backend` und
  `nix develop .#frontend` je eine. Darin laufen die Befehle aus `CLAUDE.md`
  ohne Umwege. NixOS hat kein `/lib64`; darum reicht die Schale die fertigen
  Binärpakete von `uv` und `npm` durch einen FHS-Baum, sonst starten `ruff`,
  `basedpyright`, `esbuild` und `greenlet` nicht. `uv` nimmt das Python 3.13
  aus nixpkgs, also dasselbe wie der Dienst. Das Modell hat eine eigene Schale
  in `modell/`.
- Backend: `cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8111`
- Frontend: `cd frontend && npm ci && npm start`. `proxy.conf.json` leitet
  `/api` auf `127.0.0.1:8111` und die Kachelpfade auf
  `https://pilze.beimgraben.net/`.
- SSO: dieselbe Authentik-Instanz, Redirect `http://localhost:4200/anmeldung`.
