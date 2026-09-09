# CLAUDE.md — Pilzkarte App

Einstieg für jeden Agenten in diesem Repo. Das Produkt ist im
Konzept beschrieben, die Screens in den Mockups, der Betrieb im
Betriebsvertrag. Erst lesen, dann bauen.

| Dokument | Inhalt |
| --- | --- |
| `docs/konzept.html` | Ziel, Aufbau, Screens, Bedienmuster, Features je Meilenstein, Technik, Entscheidungen |
| `docs/mockups/*.dc.html` | ein Artboard je Screen, 390 × 844, Tokens des ui-kits. `bauen.py` erzeugt sie und ist die Quelle der Maße |
| `docs/betrieb.md` | Pfade, Umgebung, Dienst, Caddy, Deploy. Vertrag zum NixOS-Modul |
| `docs/sso-authentik.md` | der OIDC-Client, gegen den Frontend und Backend laufen |
| `docs/arbeitspakete.md` | die Arbeitspakete mit Abnahmekriterien, in Reihenfolge |

## Was das ist

Eine mobile Web-App (PWA) für die Pilzkarte: Vorhersagekarte für sammelbare
Pilzarten in Deutschland je Kalenderwoche, Eingabe-Ebenen, ein Faktor-Finder
("Kombination"), Artenkatalog, eigene Funde, Marker und Zonen mit Konto über
SSO. Die Karte selbst kommt als fertige Wertkacheln vom Rendering in
`src/pilze/`; die App färbt und kombiniert sie im Browser.

## Stack

| Teil | Wahl | Fest |
| --- | --- | --- |
| Frontend | Angular 22, standalone, Signals, zoneless, strict TS, getrennte `.html`/`.scss` | ja |
| UI | `@stupa-makers/ui-kit` aus `github:STUPA-MAKERS/ui-kit` (peer ^20, per `overrides` auf 22 gehoben), Tokens nur semantisch (`--color-*`) | ja |
| Karte | MapLibre GL JS, Hintergrund OpenFreeMap "liberty", eigenes Protokoll `wert://` mit Worker für Färben und Kombination | ja |
| Zeichnen | Terra Draw mit MapLibre-Adapter, Turf für Fläche und Punkt-in-Fläche | ja |
| Offline | `@angular/service-worker` für die Hülle, IndexedDB über `idb` für Warteschlange und Kacheln, später PMTiles für Gebiete | ja |
| Auth | `oidc-client-ts`, Authorization Code + PKCE, Token im Speicher, stille Erneuerung | ja |
| Backend | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic, SQLite über aiosqlite, PyJWT gegen JWKS | ja |
| Tests | Frontend Vitest + Testing Library + axe, Backend pytest + httpx; Playwright für drei Kernflüsse | ja |

Die Paketliste des Backends ist im NixOS-Modul festgeschrieben, siehe
Betriebsvertrag. Ein Paket außerhalb der Liste läuft auf dem Server nicht.

## Struktur

```
frontend/          Angular-Projekt "pilzkarte"
  src/app/core/    api, auth, i18n, theme, offline, pwa
  src/app/map/     MapLibre-Wrapper, wert://-Protokoll, Worker
  src/app/shell/   Navigation, Blatt, Zeitleiste
  src/app/features/karte|arten|eintraege|konto|kombination
  src/app/ui/      mobile Bausteine, die dem Kit fehlen (BottomNav, Sheet, ChipGroup, Segmented, Timeline, ListRow, ActionBar)
backend/
  app/main.py      FastAPI-App
  app/core/        settings, db, auth (JWKS), errors (problem+json)
  app/modules/     arten, funde, marker, zonen, fotos, kombinationen, offline
  migrations/      Alembic, ein Head
  tests/
  deploy.stamp     wird vom Deploy geschrieben, nicht committen
```

## Hausregeln

Übernommen aus STUPA-Workflow, angepasst an ein kleines Projekt ohne Docker.

- **TDD.** Test zuerst, dann der kleinste Code, dann aufräumen. Kein `skip`
  ohne Grund.
- **problem+json** auf jedem Fehlerpfad (RFC 9457). Nie das FastAPI-`detail`.
- **RBAC serverseitig.** Der Besitzer eines Objekts kommt aus dem Token
  (`sub`), nie aus dem Body. Fremde Objekte liefern 404, nicht 403.
- **Streng typisiert.** Enums statt freier Strings, `Annotated`-Validierung,
  kein bloßes `Any`. Frontend `strict`, keine `any`.
- **Zeit ist tz-aware.** `datetime.now(UTC)`, ISO-8601 mit Offset auf dem
  Draht. Wochen als `{"jahr": 2026, "woche": 40}`.
- **Ein Vertrag.** camelCase in JSON, identische Feldnamen auf beiden Seiten.
  Das Frontend erfindet keine Felder. OpenAPI ist die Quelle, nicht das Gedächtnis.
- **Zahlen mit Bezug.** Jede Zahl in der Oberfläche sagt, worauf sie sich
  bezieht: Art, Woche, Ort oder Fläche, Größe. Siehe Konzept, "Zahlen mit Bezug".
- **i18n de/en** von Anfang an, jede Zeichenkette in beiden Katalogen.
  Deutsch ist die Leitsprache.
- **a11y.** Labels, Fokusreihenfolge, Tastatur, Kontrast, `axe` in den Tests.
- **Hell und dunkel** gegen den Prod-Build prüfen, Tokens nur semantisch.
- **Alembic:** ein Head, Hash-IDs, `CREATE TABLE IF NOT EXISTS` in Migrationen,
  die Tabellen anlegen.
- **Abdeckung:** 90 % Zeilen und Zweige beide Seiten zum Start, 100 % Zweige
  in `backend/app/core/auth` und in der Offline-Warteschlange.
- **Geschützte Arten:** Fundorte von Steinpilz und Pfifferling gehen nie in
  eine öffentliche Antwort. Geteilte Funde geschützter Arten werden auf 5 km
  gerundet, eigene Funde exakt.
- **Fotos:** höchstens drei je Fund, serverseitig auf 1600 px verkleinert,
  EXIF und GPS entfernt, nur JPEG und WebP.
- **Kommentare sagen Warum, nie Was.** Kein Kommentar, der den Code
  nacherzählt, keine Schritt-für-Schritt-Erzählung, keine auskommentierten
  Reste. Ein Kommentar steht dort, wo der Code allein eine Entscheidung
  nicht erklärt: eine Falle, eine Messung, ein Grund gegen den naheliegenden
  Weg. Sonst spricht der Name.
- **Sauber bleibt sauber.** Kein toter Code, keine ungenutzten Importe,
  keine `console.log`- oder `print`-Reste, keine TODOs ohne Paketbezug.
  Ruff und ESLint laufen mit allen Regeln, die das Projekt setzt, und sind
  vor jedem Commit grün.
- **Tests gehören zum Paket.** Jede Funktion, jeder Endpunkt, jede
  Komponente hat Tests, die das Verhalten belegen, nicht die Implementierung.
  Ein Paket ohne Tests ist nicht fertig.
- **Schreiben in Prosa:** Doku, Docstrings, Commits nach STE-Regeln
  (kurze Sätze, ein Gedanke je Satz, aktiv).

## CI

GitHub Actions in `.github/workflows/ci.yml`, flacher Fan-out: `be-lint`,
`be-typecheck`, `be-test` (mit Abdeckungsgrenze), `fe-lint`, `fe-typecheck`,
`fe-test` (mit Abdeckungsgrenze), `fe-build` (Budgets). Alle sind Pflicht
für einen Merge nach `main`. Ein Paket ist erst fertig, wenn CI auf dem
Branch grün ist.

## Befehle

```
cd backend  && uv sync && uv run pytest && uv run ruff check . && uv run basedpyright
cd frontend && npm ci && npm test && npm run lint && npm run typecheck && npm run build
```

Ein Arbeitspaket ist fertig, wenn alle sechs Befehle grün sind, die
Abnahmekriterien aus `arbeitspakete.md` erfüllt sind und der Eintrag dort
abgehakt ist.

## Was Agenten nicht tun

- Kein Deploy, kein `nixos-rebuild`, kein Schreiben nach `~/.nixos-config`.
  Das macht der Product Owner.
- Keine neuen Python-Pakete außerhalb der Liste im Betriebsvertrag.
- Keine Inhalte von 123pilzsuche.de übernehmen; verlinken ist erlaubt,
  Texte sind selbst zu schreiben.
- Keine Trainingsfunde als Punkte anzeigen.
