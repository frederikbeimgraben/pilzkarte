# Pilzkarte

[![CI](https://github.com/frederikbeimgraben/pilzkarte/actions/workflows/ci.yml/badge.svg)](https://github.com/frederikbeimgraben/pilzkarte/actions/workflows/ci.yml)

Web-App zur Pilzvorhersage in Deutschland. Die Karte zeigt je Kalenderwoche,
wo eine sammelbare Art wahrscheinlich wächst. Dazu Eingabe-Ebenen, ein
Faktor-Finder, ein Artenkatalog und eigene Funde, Marker und Zonen mit Konto.

Live: https://pilze.beimgraben.net/

| Ordner | Inhalt |
| --- | --- |
| `frontend/` | Angular 22, `@stupa-makers/ui-kit`, MapLibre GL, Terra Draw, PWA |
| `backend/` | Python 3.13, FastAPI, SQLAlchemy async, Alembic, SQLite, OIDC gegen Authentik |
| `modell/` | Vorhersagekette: GBIF und DWD laden, LightGBM je Art, Kacheln rendern |
| `docs/` | Konzept, Mockups, Betrieb, Arbeitspakete |
| `deploy/` | rsync-Skripte für den Homeserver |

Einstieg: `CLAUDE.md`. Betrieb: `docs/betrieb.md`. Reihenfolge der Arbeit:
`docs/arbeitspakete.md`.

## Lizenz

GPL-3.0-or-later, siehe `LICENSE`.
