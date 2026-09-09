# Pilzkarte

[![CI](https://github.com/frederikbeimgraben/pilzkarte/actions/workflows/ci.yml/badge.svg)](https://github.com/frederikbeimgraben/pilzkarte/actions/workflows/ci.yml)

Mobile Web-App zur Pilzkarte: Vorhersage sammelbarer Pilzarten in
Deutschland je Kalenderwoche, Eingabe-Ebenen, ein Faktor-Finder,
Artenkatalog, eigene Funde, Marker und Zonen mit Konto über SSO.

Die Vorhersage selbst rechnet das Repo [Pilze](https://github.com/frederikbeimgraben/Pilze)
und liefert sie als Wertkacheln; diese App färbt und kombiniert sie im
Browser. Live unter https://pilze.beimgraben.net/.

| Teil | Stack |
| --- | --- |
| `frontend/` | Angular 22, `@stupa-makers/ui-kit`, MapLibre GL, Terra Draw, PWA |
| `backend/` | Python 3.13, FastAPI, SQLAlchemy async, Alembic, SQLite, OIDC über Authentik |
| `docs/` | Konzept, Mockups, Betrieb, Arbeitspakete |
| `deploy/` | rsync-Skripte für Homeserver |

Einstieg für Entwicklung und Agenten: `CLAUDE.md`. Betrieb:
`docs/betrieb.md`. Reihenfolge der Arbeit: `docs/arbeitspakete.md`.

## Lizenz

GPL-3.0-or-later, wie das ui-kit, von dem die App abhängt. Siehe `LICENSE`.
