# CLAUDE.md

Einstieg für jeden Agenten in diesem Repo. Lies zuerst diese Datei, dann das
Dokument, das dein Paket nennt.

| Dokument | Inhalt |
| --- | --- |
| `docs/konzept.html` | Ziel, Aufbau, Screens, Bedienmuster, Features je Meilenstein, Technik |
| `docs/mockups/*.dc.html` | ein Artboard je Screen, 390 × 844. `bauen.py` erzeugt sie und ist die Quelle der Maße |
| `docs/betrieb.md` | Pfade, Umgebung, Dienst, Caddy, Deploy. Vertrag zum NixOS-Modul |
| `docs/sso-authentik.md` | der OIDC-Client für Frontend und Backend |
| `docs/arbeitspakete.md` | Arbeitspakete mit Abnahmekriterien, in Reihenfolge |
| `modell/README.md`, `modell/BACKLOG.md` | das Modell: Ziel, Datenlage, gemessene Entscheidungen |

## Produkt

Eine PWA für die Pilzkarte: Vorhersage sammelbarer Arten je Kalenderwoche,
Eingabe-Ebenen, Faktor-Finder ("Kombination"), Artenkatalog, eigene Funde,
Marker und Zonen mit Konto über SSO. Die Kette in `modell/` liefert
Wertkacheln. Die App färbt und kombiniert sie im Browser.

## Stack

| Teil | Wahl |
| --- | --- |
| Frontend | Angular 22, standalone, Signals, zoneless, strict TS, getrennte `.html` und `.scss` |
| UI | `@stupa-makers/ui-kit` (Tarball unter `frontend/vendor/`), Tokens nur semantisch (`--color-*`) |
| Karte | MapLibre GL JS, Hintergrund OpenFreeMap "liberty", Protokoll `wert://` mit Worker |
| Zeichnen | Terra Draw mit MapLibre-Adapter, Turf |
| Offline | `@angular/service-worker`, IndexedDB über `idb`, später PMTiles |
| Auth | `oidc-client-ts`, Authorization Code mit PKCE, Token im Speicher |
| Backend | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic, SQLite, PyJWT gegen JWKS |
| Tests | Vitest, Testing Library, axe. pytest, httpx. Playwright für drei Kernflüsse |

Die Paketliste des Backends steht in `docs/betrieb.md`. Ein Paket außerhalb
der Liste läuft auf dem Server nicht.

## Struktur

```
frontend/
  src/app/core/      api, auth, config, i18n, theme, offline, pwa
  src/app/map/       MapLibre-Wrapper, wert://-Protokoll, Worker
  src/app/shell/     Navigation, Blatt, Zeitleiste
  src/app/features/  karte, arten, eintraege, konto, kombination
  src/app/ui/        gemeinsame Bausteine
backend/
  app/main.py        FastAPI-App
  app/core/          settings, db, auth, errors
  app/shared/        schemas, paging, bilder
  app/modules/       arten, funde, marker, zonen, fotos, kombinationen
  migrations/        Alembic, ein Head
  tests/
modell/
  src/pilze/         die Kette
  update.sh          wöchentliche Kette auf dem Homeserver
  run_all.sh         alle Arten trainieren und rendern
deploy/              rsync für Frontend und Backend. `modell/deploy_daten.sh` für die Kette
```

`modell/` läuft mit Python 3.12 aus `modell/flake.nix` und Paketen aus
nixpkgs. Änderungen dort prüft ein Render einer Art (`render_de.sh`).

## Gemeinsame Bausteine

Was auf zwei Screens vorkommt, ist eine Komponente in `src/app/ui/`. Seiten
komponieren, sie stylen nicht. Ein Maß, das zweimal vorkommt, ist ein Token.
Quelle der Maße: `docs/mockups/bauen.py`.

| Baustein | In `bauen.py` | Screens |
| --- | --- | --- |
| `BottomNav` | `nav()`, 64 px | alle Reiter |
| `Sheet` | `.blatt`, `.griff`, drei Rasten | Karte, Objekte, Melden, Anmelden, Aktionen |
| `SheetHead` | `kopf()` | Karte, Faktor |
| `Timeline`, `WeekButton` | `zeitleiste()`, `.woche` 44 × 48 | Karte, Desktop |
| `Segmented` | `seg()`, Rolle tablist | Darstellung, Regel, Sichtbarkeit, Bedingung |
| `ChipGroup` | `.chips`, `.chip` | Arten, Einträge, Ebenen |
| `ListRow` | `.liste .zeile`, `fundzeile()`, `einstellung()` | Einträge, Konto, Ebenen |
| `ActionBar` | `fuss()` | Fund, Zone, Melden, Anmelden, Art, Faktor, Kombination, Ort, Zeichnen |
| `ActionSheet`, `ActionRow` | `aktionsreihe()` | Plus-Menü |
| `FloatingButton` | `schwebend()`, 48 px, Radius 14 | Karte |
| `PageHeader` | `.kopfleiste` | Arten, Art, Einträge, Konto |
| `KeyValueTable`, `KeyValueRow` | `.tabelle`, `.tz` | Art, Zone, Faktor |
| `MetricRow` | Beschriftung, Unterzeile, Wert rechts | Fund, Zone |
| `SeasonCurve` | `funke()` | Arten, Art |
| `Ramp` | `rampe()` | Vorhersage, Ebene, Kombination |
| `Crosshair` | `.kreuz` | Fundort, Zone zeichnen |
| `FactorRow` | `faktor_zeile()` | Kombination |
| `Histogram`, `RangeSlider` | `histogramm()`, `schieber()` | Faktor |
| `ColorSwatches` | Farbfelder 36 px, Radius 10 | Zone, Marker |
| `FormField` | `.label`, `.feld` | Melden, Zone, Marker |
| `SpeciesRow` | `artkarte()` | Arten |
| `AvatarButton` | Kreis oben links | Karte |
| `Note` | `.notiz`, `.unter` | überall |

Card, Badge, Button, Input, Dialog und Toast kommen aus dem Kit. Fehlt ein
Baustein, lege ihn in `src/app/ui/` an, nicht in der Seite. Im Backend
liegen Besitzerprüfung, Paging, Fehler, Wochenformat und Bild-Pipeline einmal
in `app/core/` oder `app/shared/`.

## Regeln

- TDD. Test zuerst, dann der kleinste Code, dann aufräumen. Kein `skip` ohne Grund.
- Kommentare sagen Warum, nie Was. Kein Kommentar erzählt den Code nach.
- Kein toter Code, keine ungenutzten Importe, keine `print`- oder `console.log`-Reste, keine TODOs.
- Ruff und ESLint mit allen Regeln des Projekts, grün vor jedem Commit.
- Jede Funktion, jeder Endpunkt, jede Komponente hat Tests. Abdeckung 90 % Zeilen und Zweige, `backend/app/core/auth.py` und die Offline-Warteschlange 100 % Zweige.
- problem+json auf jedem Fehlerpfad (RFC 9457). Nie das FastAPI-`detail`.
- Besitzer kommt aus dem Token (`sub`), nie aus dem Body. Fremde Objekte liefern 404.
- Enums statt freier Strings. Frontend `strict`, kein `any`. Backend voll annotiert.
- Zeit tz-aware. ISO-8601 mit Offset auf dem Draht. Wochen als `{"jahr": 2026, "woche": 40}`.
- camelCase in JSON, gleiche Feldnamen auf beiden Seiten. OpenAPI ist die Quelle.
- Jede Zahl in der Oberfläche nennt Art, Woche, Ort oder Fläche und die Größe.
- i18n de/en für jede Zeichenkette. Deutsch führt. Texte der Mockups sind abgenommen.
- a11y: Labels, Fokusreihenfolge, Tastatur, Kontrast, axe in den Tests.
- Hell und dunkel gegen den Prod-Build prüfen.
- Alembic: ein Head, Hash-IDs, `CREATE TABLE IF NOT EXISTS`.
- Fundorte von Steinpilz und Pfifferling gehen nie exakt in eine öffentliche Antwort. Geteilte Funde geschützter Arten auf 5 km gerundet.
- Fotos: höchstens drei je Fund, 1600 px, EXIF und GPS entfernt, JPEG oder WebP.
- Doku, Docstrings, Commits in kurzen, aktiven Sätzen. Ein Gedanke je Satz.

## CI

`.github/workflows/ci.yml`: `be-lint`, `be-typecheck`, `be-test`, `fe-lint`,
`fe-typecheck`, `fe-test`, `fe-build`. Alle sind Pflicht für einen Merge nach
`main`.

## Befehle

```
cd backend  && uv sync && uv run pytest && uv run ruff check . && uv run basedpyright
cd frontend && npm ci && npm test && npm run lint && npm run typecheck && npm run build
```

Ein Paket ist fertig, wenn diese Befehle grün sind, die Abnahmekriterien
belegt sind und CI auf dem Branch grün ist.

## Nicht erlaubt

- Deploy, `nixos-rebuild`, Schreiben nach `~/.nixos-config`. Das macht der Product Owner.
- Python-Pakete außerhalb der Liste in `docs/betrieb.md`.
- Inhalte von 123pilzsuche.de. Verlinken ja, Texte selbst schreiben.
- Trainingsfunde als Punkte anzeigen.
