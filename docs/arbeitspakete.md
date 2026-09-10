# Arbeitspakete

Ein Paket ist ein Auftrag an einen Agenten. Es endet mit grünen Tests und
einem PR. Der Product Owner nimmt ab und deployt. **[P]** heißt: läuft
parallel zu den Nachbarn im Block. **Abnahme** belegt der Agent im Bericht
Punkt für Punkt.

## Block 0, Fundament

### A0 Backend-Gerüst

Ordner `backend`. FastAPI-App mit Settings aus Umgebung (`PILZE_*`),
problem+json-Handler, SQLAlchemy-async-Engine, Alembic mit Baseline,
Health-Endpunkt, `GET /api/config` (Issuer, Client ID, Origin, Version),
Auth-Modul: JWKS vom Issuer laden und cachen, Bearer-Token prüfen (`iss`,
`aud`, `exp`, Signatur), `sub` und `email` als `Nutzer`-Objekt. Dependency
`aktueller_nutzer` (Pflicht) und `nutzer_optional`. `pyproject.toml` mit
`uv`, dev-Extras, ruff, basedpyright strict, pytest-asyncio.

Abnahme:
- `uv run pytest` grün, Abdeckung ≥ 90 %, `core/auth` 100 % Zweige
- Token mit falschem `aud`, abgelaufen, falscher Signatur, fehlend: je 401 als problem+json
- JWKS-Cache: zweiter Aufruf trifft das Netz nicht (Test mit gemocktem httpx)
- `alembic upgrade head` auf leerer SQLite legt das Schema an, `alembic heads` genau einer
- `GET /api/health` 200, `GET /api/config` liefert die vier Felder
- läuft mit genau den Paketen aus `betrieb.md`

### A0b CI **[P zu A0, A1]**

`.github/workflows/ci.yml` mit den sieben Jobs aus `CLAUDE.md`, Caches für
`uv` und `npm`, Node 24, Python 3.13. Jobs, deren Ordner noch fehlt, enden
grün mit einem Hinweis, bis A0 und A1 gemergt sind. Branch-Schutz auf
`main`: alle Jobs Pflicht, kein Force-Push. Dependabot für npm, pip und
Actions, wöchentlich.

Abnahme:
- CI läuft auf Pull Requests und auf `main`, alle Jobs grün
- ein absichtlich fehlschlagender Test bricht den Job (im Bericht belegen und wieder entfernen)
- Laufzeit unter 6 Minuten bei warmem Cache

### A1 Frontend-Gerüst **[P zu A0]**

Ordner `frontend`, Angular 22 (`npx @angular/cli@22 new pilzkarte
--standalone --style=scss --ssr=false --zoneless`), ui-kit aus GitHub mit
`overrides` für die Peer-Versionen, Tokens und Archivo eingebunden,
`data-theme` hell/dunkel/system mit Persistenz, i18n-Dienst de/en mit
Signal-Locale, `ApiClient` über `/api` mit problem+json-Fehlern als Toast,
Proxy-Konfiguration (`/api` lokal, Kachelpfade auf pilze.beimgraben.net),
Vitest mit Testing Library und axe, ESLint, Budgets im `angular.json`.

Alle gemeinsamen Bausteine aus der Tabelle in `CLAUDE.md` als eigene
Komponenten in `src/app/ui/`, nach Maßen aus `docs/mockups/bauen.py` und
den Artboards. Jeder Baustein: eine Komponente, Inputs als Signals, Tokens
nur semantisch, keine seitenspezifischen Stile. Was das Kit schon hat
(Button, Card, Badge, Input, Dialog, Toast), wird aus dem Kit genommen und
nicht nachgebaut.

Abnahme:
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` grün
- jede Baustein-Komponente hat einen Test mit axe ohne Verstoß
- Seite `/bausteine` (nur dev) zeigt alle Bausteine in hell und dunkel, neben dem Artboard `Bausteine` verglichen
- keine Komponente außerhalb von `src/app/ui/` definiert eine Höhe, einen Radius oder eine Farbe für einen Baustein
- Prod-Build unter 600 kB initial, Bundle-Budget im `angular.json`

### A2 Shell und Karte

Voraussetzung A1. Shell mit BottomNav (Karte, Arten, Einträge) und Avatar
oben rechts. Route `/karte` mit MapLibre, Hintergrund OpenFreeMap liberty in
hell und dunkel, Deutschland-Grenzen als `maxBounds` mit Rand. Blatt mit
Kopf (Art, Woche, Zeitleiste) in drei Rasten. Protokoll `wert://` mit
Worker: holt die Wertkachel `<slug>/<woche>/z/x/y.png`, färbt über die
Nachschlagetabelle des Manifests, liefert RGBA an eine Rasterquelle.
Manifest `<slug>.json` liefert Wochen, `top`, `mean`/`max`. Zeitleiste
zeigt die Wochen des Manifests mit Balken aus `mean`, Pfeile und Play.
Darstellung "Vorhersage" mit Rampe und Legende "Fundwahrscheinlichkeit je
Begehung", 0 % bis Höchstwert. Deep Links `/karte?art=steinpilz&kw=2026-40`.

Abnahme:
- Karte lädt Steinpilz KW der aktuellen Woche in unter 2 s auf DSL (Prod-Build gegen pilze.beimgraben.net)
- Wochenwechsel tauscht die Quelle ohne Flackern, Nachbarwochen vorgeladen
- Blatt: drei Rasten per Geste und Tipp, Karte wird auf den freien Streifen eingepasst
- Legende und Kopf entsprechen den Mockups `Main`, `KarteEingeklappt` in Maß und Text
- Vitest für Worker-Färbung (Byte → Farbe, 0 → transparent) und Manifest-Parser

## Block 1, Darstellung

### B1 Ebenen **[P zu B2]**

Route und Darstellung "Ebene": `layers.json` lesen, Ebenen-Liste im Blatt
mit Gruppen (je Woche, fest), gewählte Ebene über `wert://` mit eigener Rampe
und Einheit, Wochenebenen folgen der Zeitleiste. Ebenen-Knopf auf der Karte:
Hintergrund (hell, dunkel, Topo, Satellit), Deckkraft, später Marker und
Zonen. Screens `Ebene`, `KarteEbenen`.

Abnahme:
- alle Ebenen aus `layers.json` sichtbar, Einheit und Rampe je Ebene richtig
- Deckkraft wirkt sofort, Hintergrundwechsel behält Position und Zoom

### B2 Kombination und Faktor **[P zu B1]**

Darstellung "Kombination" ohne Art: Faktoren mit Bedingung (unter, über,
zwischen), Regel Schnittmenge oder Abgestuft (geometrisches Mittel der
Erfüllungsgrade), Worker rechnet je Punkt aus mehreren Quellen. Screen
`Faktor` mit Histogramm der Ebene (vorgerechnet, siehe C2), zwei Griffen,
Anteil der Fläche. Kombination im URL-Zustand, später im Konto speichern.
Screens `Kombination`, `Faktor`.

Abnahme:
- Schnittmenge einfarbig, Abgestuft als Rampe. Wechsel unter 200 ms bei Zoom 7
- Faktor: Histogramm, Griffe, Anteil in Prozent, Bedingung als Feld
- Worker-Tests: Schnittmenge, geometrisches Mittel, fehlende Daten (0) bleiben leer

### C2 Histogramme im Rendering

In der Kette (`modell/src/pilze/input_layers.py`, `region_map.py`): je
Ebene und Woche ein Histogramm mit 40 Klassen über Deutschland, in das
Manifest der Ebene. Für die Vorhersage-Arten dasselbe je Woche.

Abnahme:
- `layers.json` und `<slug>.json` tragen `histogramm: {klassen: [...], anteile: [...]}`
- `week_stats.py` füllt bestehende Manifeste nach
- Renderzeit steigt um weniger als 5 %

### C3 Mehr Wochenebenen

Für die Kombination fehlen Metriken. Aus den DWD-Rastern der Kette lassen
sich je Woche weitere Ebenen rendern: Niederschlag 1 und 2 Wochen,
Tage seit dem letzten Regen über 5 mm, Frosttage der Woche, Hitzetage
über 25 Grad, Temperaturmittel 2 und 4 Wochen, Bodenfeuchte, falls HYRAS
oder ein anderer freier Datensatz sie liefert. Jede neue Ebene mit Einheit,
Spanne, Rampe und Histogramm in `layers.json`, Renderzeit im Bericht.

Abnahme:
- mindestens sechs neue Wochenebenen live, jede als Faktor wählbar
- `update.sh` rechnet sie ohne Zusatzschritt
- Renderzeit der Wochenebenen steigt um weniger als 30 %

## Block 2, Arten

### D1 Artenkatalog Backend

`GET /api/arten` (Liste mit Stufe, Saisonkurve, Tags), `GET /api/arten/{slug}`
(Profil als Merkmalstabelle: Hut, Röhren oder Lamellen, Stiel, Fleisch,
Geruch, Geschmack, Sporenpulver, Vorkommen, Zeit, Speisewert, Schutz,
Verwechslungen). Profile als YAML in `backend/daten/arten/*.yaml`,
selbst geschrieben, mit Links zu 123pilzsuche und Wikipedia. Saisonkurve:
Anteil positiver Begehungen je Kalenderwoche, alle Jahre und laufendes Jahr
bis zur letzten vollen Woche, aus `funde/<slug>.json` und der
Begehungstabelle (siehe `modell/src/pilze/katalog.py` und `arten_zaehlen.py`). Die Begehungstabelle liegt als Parquet-Export unter `backend/daten/`.
Stufen: Vorhersage (Manifest vorhanden), Saison (60 oder mehr Begehungen), Profil.
`arten_zaehlen.py` bekommt dabei Docstring, Argumente und Tests.

Abnahme:
- 23 Vorhersage-Arten, 42 Saison-Arten, 20 Profil-Arten laut `arten_zaehlen.py`, alle mit Profil
- Saisonkurve in Prozent, beide Reihen, Test gegen eine Fixture
- Tests je Endpunkt, Schema strikt, camelCase

### D1d Profile nach 123pilzsuche geprüft

Jedes der 85 Profile Feld für Feld gegen die verlinkte Seite auf
123pilzsuche.de prüfen. 123pilzsuche ist die primäre Quelle für die Fakten,
die Texte bleiben eigene Worte. Verwechslungen nur die, die die Seite nennt.
Je Profil ein Feld `quelle` mit URL und Prüfdatum.

Abnahme:
- Tabelle im PR: Art, URL, korrigierte Felder, Verwechslungen vorher und nachher
- Test: jedes Profil hat `quelle`, keine leeren Felder

### D1e Gegenkontrolle der Inhalte

Nach D1d. Mehrere Agenten prüfen die Profile unabhängig voneinander und
gegeneinander. Je Art ein Prüfer, der die Seite auf 123pilzsuche und eine
zweite Quelle (Wikipedia, DGfM) liest und jede Abweichung im Profil als
Befund meldet, mit Zitat der Quelle. Ein zweiter Agent entscheidet je Befund
und korrigiert. Kein Profil gilt als richtig, das nicht zwei Prüfer ohne
Befund passiert hat. Läuft als Workflow mit Fan-out je Art.

Abnahme:
- Befundliste je Art mit Entscheidung, im Repo unter `backend/daten/pruefung/`
- 85 Profile ohne offenen Befund
- `quelle.geprueftAm` auf das Datum der Gegenkontrolle gesetzt

### D2 Arten Frontend

Voraussetzung D1, A1. Reiter Arten: Suche, Chips (alle, mit Vorhersage,
Röhrlinge, Herbst), Liste als Raster mit Kurve rechts und Tags darunter.
Artseite tabellarisch, Saisonkurve mit beiden Reihen und Legende, Fußleiste
"Auf der Karte anzeigen". Screens `Arten`, `Art`.

Abnahme:
- Liste und Artseite pixelnah zu den Mockups, hell und dunkel
- Kurve: laufendes Jahr endet mit Punkt, Höchstwert als Achsenbeschriftung
- axe ohne Verstoß, Tastaturbedienung der Liste

### D3 Taxonomie

Nach D1d. Jede Art bekommt ihre Einordnung: Gattung, Familie, Ordnung,
Klasse, mit lateinischem und deutschem Namen. Quelle ist das GBIF-Backbone
(`/v1/species/match` je lateinischem Namen), abgelegt als
`backend/daten/taxonomie.json` durch ein Skript in `modell/`, deutsche
Namen der Gattungen und Familien aus 123pilzsuche oder Wikipedia mit
Quelle. Endpunkte `GET /api/taxonomie/{rang}/{slug}` (Rang als Enum) mit
den Arten darunter, dem Elternrang und den Geschwistern. Das Profil trägt
`taxonomie` mit Slugs je Rang.

Frontend: Seiten `/taxonomie/gattung/boletus`, `/taxonomie/familie/boletaceae`
und so weiter. Jede Seite zeigt beides: die äußere Taxonomie (Pfad nach
oben bis zur Klasse, Geschwister auf derselben Stufe) und die innere
(Kinder: Gattungen einer Familie, Arten einer Gattung, als `SpeciesRow`).
Die Artseite verlinkt Gattung und Familie unter dem lateinischen Namen. Die
Artenliste bekommt Chips je Gruppe, die auf die Ordnung zeigen.

Abnahme:
- 85 Arten mit vollständiger Einordnung, Test gegen die JSON-Datei
- Jede Taxonomie-Seite erreichbar aus der Artseite und zurück
- axe ohne Verstoß, Screenshots Gattung und Familie hell

## Block 3, Konto und Objekte

### E1 Auth Frontend

`oidc-client-ts` mit PKCE gegen den Issuer aus `/api/config`, Routen
`/anmeldung` und `/anmeldung/still`, Token im Speicher, stille Erneuerung,
`Authorization: Bearer` nur an `/api`. Anmelde-Blatt erst beim ersten
Speichern (Screen `Anmelden`). Konto-Screen `Mehr` mit Abmelden,
Darstellung, Offline, Über.

Abnahme:
- Anmelden gegen sso.beimgraben.net funktioniert lokal und in Prod
- Karte, Arten, Ebenen ohne Anmeldung nutzbar
- abgelaufenes Token wird still erneuert. Scheitert das, öffnet sich das Anmelde-Blatt statt eines Fehlers

### E2 Funde, Marker, Zonen Backend **[P zu E1]**

Modelle und Endpunkte unter `/api/funde`, `/api/marker`, `/api/zonen`: CRUD
je Besitzer, Sichtbarkeit privat oder geteilt, Zonen als Polygon (GeoJSON),
Fotos `POST /api/funde/{id}/fotos` (≤ 3, 1600 px, EXIF weg, JPEG),
`GET /api/funde/geteilt?bbox=` mit Rundung geschützter Arten auf 5 km.
Zone: `GET /api/zonen/{id}/wert?art=&kw=` liefert Flächenmittel aus den
Kacheln in `PILZE_MAPS` und die Zahl eigener Funde in der Fläche.

Abnahme:
- Besitzerprüfung: fremdes Objekt 404, Test je Endpunkt
- Foto-Pipeline: EXIF und GPS nachweislich entfernt (Test liest die Datei zurück)
- geteilte Funde geschützter Arten nie exakt, Test mit Steinpilz und Pfifferling
- Alembic-Migration mit `IF NOT EXISTS`, ein Head

### E3 Eintragen und Einträge Frontend

Voraussetzung E1, E2, A2. Plus-Knopf öffnet Aktionsblatt (Fund, Marker,
Zone). Fundort mit Fadenkreuz, Formular (Art, Anzahl, Datum, Notiz,
Sichtbarkeit, Fotos), Marker mit Name und Notiz, Zone mit Terra Draw
(Eckpunkte, Fläche läuft mit), Objekt-Blätter Fund, Marker, Zone mit
Fußleiste. Reiter Einträge mit Chips (Funde, Marker, Zonen, geteilt).
Ebenen-Knopf zeigt eigene Marker und Zonen, geteilte Funde. Screens
`KarteAktionen`, `MeldenOrt`, `MeldenFormular`, `ZoneZeichnen`, `Fund`,
`Zone`, `Funde`.

Abnahme:
- alle sieben Screens pixelnah, hell und dunkel, Texte wie in den Mockups
- Fund mit drei Fotos in unter 10 s auf LTE gespeichert
- Zone: Fläche in ha während des Zeichnens, Wert und Funde im Zonen-Blatt
- Playwright: Fund melden von der Karte bis zum Eintrag in der Liste

### E5 Funde für das Training freigeben

Beim Fund wählt man, ob er in die Trainingsdaten einfließt
(`fuerTraining`, Vorgabe aus). Ein interner Endpunkt, nur vom Homeserver
selbst erreichbar, liefert die freigegebenen Funde exakt. `update.sh`
holt sie vor dem Bau der Vorkommenstabelle, `build_occurrences.py` hängt
sie mit Quelle `app` an.

Abnahme:
- Schalter im Fund-Formular, Feld in allen Fund-Antworten
- Endpunkt über den Vhost 404, von 127.0.0.1 200, Test für beide
- Fixture-Test in `modell/tests/`: ein freigegebener Fund landet als Begehung mit Fund in der Tabelle

### R1 bis R3 Bezeichner auf Englisch

Der Code trägt heute deutsche Bezeichner. Das wird umgestellt, in drei
Schritten, damit jeder Schritt für sich grün bleibt.

- **R1** Backend, nur intern: Klassen, Methoden, Variablen, Dateinamen,
  Testnamen. Der Vertrag nach außen bleibt unverändert.
- **R2** Frontend, nur intern: Komponenten, Selektoren (`app-*`), Dienste,
  Signale, Dateinamen, CSS-Klassen, Testnamen. Vertrag und i18n-Schlüssel
  bleiben.
- **R3** Vertrag und Speicher, beide Seiten in einem Zug: Feldnamen in
  JSON, Spalten in der Datenbank samt Migration, i18n-Schlüssel, Slugs der
  Routen. Erst wenn R1 und R2 stehen.

Abnahme je Schritt:
- Kein deutscher Bezeichner mehr im betroffenen Bereich, geprüft mit einer
  Wortliste im Testlauf
- Verhalten unverändert, alle Tests grün, Abdeckung wie vorher
- Kommentare und Dokumente bleiben deutsch

### G1 Texte in der Datenbank

Die Oberfläche trägt heute ihre Texte im Code. Sie ziehen in die
Datenbank um und werden mit einer Rolle bearbeitbar.

- Tabelle `text` (Schlüssel, Sprache, Wert, geändert am, geändert von).
  Eine Migration schreibt den Anfangsbestand aus dem heutigen Katalog,
  beide Sprachen, und ist wiederholbar.
- `GET /api/texte?sprache=de` liefert den ganzen Katalog, öffentlich, mit
  ETag und langer Gültigkeit. `PUT /api/texte/{schluessel}` ändert einen
  Text, nur mit der Rolle `admin`. `DELETE` setzt auf die Vorgabe zurück.
- Die Rolle kommt aus dem Anspruch `groups` des Tokens. Die Gruppe heißt
  `pilze-admins` und steht im NixOS-Blueprint von Authentik; der Name
  steht in `PILZE_ADMIN_GRUPPE`.
- Fehler und Meldungen des Backends nutzen dieselben Schlüssel.

Abnahme:
- Kein Text mehr fest im Code, geprüft mit einem Test über die Vorlagen
- Ohne Anmeldung liest jeder, ohne die Rolle schreibt niemand (Test)
- Migration auf leerer und auf bestehender Datenbank grün

### G2 Texte bearbeiten

Der Client lädt den Katalog beim Start vom Server und hält den
mitgelieferten Bestand als Rückfall. Unter Konto steht für die Rolle
`admin` ein Punkt „Texte": Liste aller Schlüssel nach Bereich, Suche,
Anzeige beider Sprachen nebeneinander, Ändern, Zurücksetzen, Hinweis auf
geänderte Einträge. Eine Änderung wirkt sofort in der Oberfläche.

Abnahme:
- Ohne Rolle ist der Punkt nicht sichtbar und die Route führt zurück
- Offline zeigt die App den zuletzt geladenen Katalog
- Ein geänderter Text erscheint nach dem Speichern ohne Neuladen

## Block 4, Offline und Feinschliff

### F1 Offline-Warteschlange und PWA

Service Worker mit `ngsw`, Manifest, Installationshinweis. IndexedDB über
`idb`: Warteschlange für Funde, Marker, Zonen mit Fotos. Status
"Übertragung ausstehend" in der Liste. Übertragung bei Netz. Zuletzt
gesehene Kacheln im Cache mit Obergrenze. Konto-Screen zeigt Speicher und
ausstehende Übertragungen.

Abnahme:
- Playwright mit Netz aus: Karte öffnet mit gesehenen Kacheln, Fund geht später raus
- Warteschlange 100 % Zweige
- Lighthouse PWA-Prüfung ohne Fehler

### F2 Offline-Gebiete

PMTiles-Archiv für Deutschland auf dem Server (`/karte/deutschland.pmtiles`,
Erzeugung als Skript in `tools/`), `pmtiles`-Protokoll im Client,
Gebiet als Rechteck oder Landkreis wählen, Kacheln bis Zoom 14 und
Wertkacheln der gewählten Arten laden, in IndexedDB ablegen, Protokoll
bedient erst lokal. Verwaltung unter Konto, Offline.

Das Archiv baut `tools/pmtiles/bauen.sh` mit Planetiler aus dem
Geofabrik-Extrakt für Deutschland, mit denselben Argumenten wie
OpenFreeMap. So tragen die Kacheln das unveränderte OpenMapTiles-Schema,
und die Stile „liberty“ und „dark“ passen offline wie online. OpenFreeMap
selbst bietet nur den ganzen Planeten zum Herunterladen an, kein PMTiles
und keinen Auszug.

Abnahme:
- Landkreis-Gebiet unter 40 MB, Fortschritt sichtbar, abbrechbar
- Karte ohne Netz im Gebiet bis Zoom 14 vollständig
- Speicher und Stand je Gebiet, Aktualisieren und Löschen

### F4 Name und Icon

Die App heißt **Primordium**. Ein Primordium ist der Knoten im Myzel, aus
dem ein Fruchtkörper wird: der Moment vor dem Pilz, und genau den sagt die
App vorher. Das Icon ist die Silhouette eines Röhrlingshuts mit
Höhenlinien darin, einfarbig, lesbar ab 32 px.

Umfang: Icon als SVG in mehreren Größen und als maskierbares PNG für die
PWA, `<title>`, `manifest.webmanifest` (`name`, `short_name`, `icons`,
Themenfarbe), i18n-Schlüssel `app.title` in beiden Sprachen, README,
Konzept, Konto-Screen unter Über. Der Ordner und das Repo behalten den
Namen `pilzkarte`, die Domain bleibt `pilze.beimgraben.net`.

Abnahme:
- Icon in hell und dunkel auf dem Startbildschirm eines Telefons geprüft
- Lighthouse PWA-Prüfung ohne Fehler zu den Icons
- kein Vorkommen von „Pilzkarte“ mehr in der Oberfläche

### F3 Feinschliff

Onboarding drei Screens, Standort-Knopf, Fehlerzustände, Leistungsbudget,
a11y-Audit gegen AA, Desktop-Layout (Screen `Desktop`: Blatt als Seitenleiste
ab 1024 px), beide Themes gegen den Prod-Build.

Abnahme:
- axe und Lighthouse a11y ohne Fehler auf allen Routen
- Startzeit unter 3 s auf einem Mittelklasse-Telefon (Lighthouse mobil)
- Desktop-Layout auf 1440 px entspricht dem Mockup

## Deploy-Pakete (Product Owner)

- **P1** `deploy/frontend.sh` und `deploy/backend.sh` erster Lauf,
  Kachelpfade prüfen.
  Erster Deploy nach A0 und A2.
- **P2** PMTiles-Archiv erzeugen und hochladen, nach F2.
