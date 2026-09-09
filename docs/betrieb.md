# Betrieb der App

Wie die App auf dem Homeserver läuft und wie sie dorthin kommt. Das ist der
Vertrag zwischen Code und NixOS-Modul: wer eine Zeile hier ändert, ändert
auch die andere Seite.

## Hosts

| Host | Rolle |
| --- | --- |
| Server (public) | terminiert TLS für `pilze.beimgraben.net`, leitet über WireGuard an den Homeserver weiter. Kein Body-Limit. |
| Homeserver | Caddy-Vhost auf Port 8110 (nur wg0). Statischer Angular-Build plus Kacheln aus `/var/www/pilze`, `/api/*` an das Backend. Rendert montags die Vorhersage. |
| Authentik | `https://sso.beimgraben.net/`, Client `pilze`, siehe `sso-authentik.md`. |

## Pfade auf dem Homeserver

| Pfad | Inhalt | Schreibt |
| --- | --- | --- |
| `/var/www/pilze` | Dokumentwurzel: Angular-Build im Wurzelverzeichnis, Kacheln je Art in `<slug>/z/x/y.png`, Manifeste `<slug>.json`, Ebenen `layers.json` und `layers_kacheln/`, Trainingsfunde `funde/` | `deploy.sh` (Build), `pilze-render` (Kacheln) |
| `/var/lib/pilze-render` | Arbeitsbaum: `src/`, `models/`, `data/interim/` aus `modell/`, dazu `app/backend/` | `modell/deploy_daten.sh`, `deploy/backend.sh` |
| `/var/lib/pilze-app` | `pilze.sqlite` und `fotos/` | Dienst `pilze-app` |

## Dienst `pilze-app`

| Punkt | Wert |
| --- | --- |
| Nutzer | `pilzeapp`, liest den Arbeitsbaum und die Dokumentwurzel, schreibt nur `/var/lib/pilze-app` |
| Start | `alembic upgrade head`, dann `uvicorn app.main:app --host 127.0.0.1 --port 8111 --proxy-headers` |
| Arbeitsverzeichnis | `/var/lib/pilze-render/app/backend` |
| Startbedingung | `app/main.py` vorhanden |
| Neustart | die Path-Unit `pilze-app-deploy` startet den Dienst neu, sobald `app/backend/deploy.stamp` geschrieben wird |
| Grenzen | 1 GB RAM, `ProtectSystem=strict` |

Umgebung, die das Backend liest:

| Variable | Wert auf dem Homeserver | Bedeutung |
| --- | --- | --- |
| `PILZE_DB` | `sqlite+aiosqlite:////var/lib/pilze-app/pilze.sqlite` | SQLAlchemy-URL |
| `PILZE_FOTOS` | `/var/lib/pilze-app/fotos` | Fotoablage, ein Unterordner je Fund |
| `PILZE_MAPS` | `/var/www/pilze` | Manifeste und Funde für Artenliste und Saisonkurve |
| `PILZE_OIDC_ISSUER` | `https://sso.beimgraben.net/application/o/pilze/` | Issuer, Discovery und JWKS werden daraus abgeleitet |
| `PILZE_OIDC_CLIENT_ID` | `pilze` | erwartete `aud` im Access-Token |
| `PILZE_ORIGIN` | `https://pilze.beimgraben.net` | eigener Ursprung, für CORS in der Entwicklung und für Links |

Lokal setzt man dieselben Variablen in `backend/.env`; Vorgaben für die
Entwicklung stehen in `backend/.env.example` und zeigen auf `./var/`.

## Python-Pakete

Das Backend läuft auf dem Python 3.13 aus nixpkgs mit genau dieser Liste.
Mehr gibt es nicht, ein neues Paket heißt: Modul ändern, Switch.

```
fastapi uvicorn sqlalchemy alembic pydantic pydantic-settings aiosqlite
pyjwt cryptography pillow httpx python-multipart
```

Entwicklung und Tests brauchen zusätzlich `pytest`, `pytest-asyncio`,
`pytest-cov`, `ruff`, `basedpyright`, `httpx` (als Testclient). Das steht in
der `pyproject.toml` unter `[dependency-groups] dev`, damit `uv sync` es von
allein installiert. Auf dem Server wird nichts installiert.

## Caddy-Verhalten

- `/api/*` geht an `127.0.0.1:8111`.
- Alles andere, das keine Datei ist, wird auf `/index.html` umgeschrieben.
  Client-Routen überleben so ein Neuladen.
- Kacheln (`*.png`) sind eine Woche immutable. Gehashte Angular-Bundles
  (`*.<hash>.js|css`) ein Jahr immutable. `index.html`, `*.json`,
  `ngsw.json` und `ngsw-worker.js` sind `no-cache`.
- Request-Body bis 40 MB, damit drei Fotos in einem Formular durchgehen.
- Range-Requests funktionieren über `file_server`; das reicht für PMTiles.

## Deploy

Zwei Wege, beide rsync über Schlüssel mit erzwungenem `rrsync -wo`, der
Zielnutzer hat keine Shell.

| Skript | Schlüssel | Ziel | Was |
| --- | --- | --- | --- |
| `deploy/frontend.sh` | `~/.ssh/pilze_deploy` | `/var/www/pilze` | Angular-Build. Schützt Kacheln, Manifeste und Ebenen vor `--delete` mit Filtern (`P /*/`, `P /*.json`) |
| `modell/deploy_daten.sh` und `deploy/backend.sh` | `~/.ssh/pilze_daten` | `/var/lib/pilze-render` | Code, Modelle und Daten der Kette aus `modell/`. Das Backend geht mit `deploy/backend.sh` an dieselbe Stelle, `app/backend/` im Arbeitsbaum, und schreibt `app/backend/deploy.stamp` als letzten Schritt |

Reihenfolge bei einer Änderung, die beides betrifft: erst `deploy/backend.sh`
(Backend, Migration läuft beim Neustart), dann `deploy/frontend.sh` (Frontend). Ein
Frontend, das ein Feld erwartet, das das Backend noch nicht liefert, ist
der häufigere Fehler als umgekehrt.

## Lokale Entwicklung

- Umgebung: `nix develop` bringt beide Seiten mit, `nix develop .#backend` und
  `nix develop .#frontend` je eine. Darin laufen die Befehle aus `CLAUDE.md`
  ohne Umwege. NixOS hat kein `/lib64`; darum reicht die Schale die fertigen
  Binärpakete von `uv` und `npm` durch einen FHS-Baum, sonst starten `ruff`,
  `basedpyright`, `esbuild` und `greenlet` nicht. `uv` nimmt das Python 3.13
  aus nixpkgs, also dasselbe wie der Dienst. Das Modell hat eine eigene Schale
  in `modell/`.
- Backend: `cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8111`
- Frontend: `cd frontend && npm ci && npm start`, Proxy `/api` auf
  `127.0.0.1:8111` über `proxy.conf.json`. Kacheln kommen in der Entwicklung
  von `https://pilze.beimgraben.net/` (Proxy-Eintrag für die Kachelpfade),
  damit lokal kein Render nötig ist.
- SSO in der Entwicklung: dieselbe Authentik-Instanz, Redirect
  `http://localhost:4200/anmeldung`.
