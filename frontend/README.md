# Pilzkarte, Frontend

Angular 22, standalone, zoneless, Signals, strenges TypeScript. Die Oberfläche
folgt den Mockups in `docs/mockups/` und dem Design-System des ui-kits.

## Befehle

```
npm ci            Abhängigkeiten aus package-lock.json
npm start         Entwicklungsserver auf 4200, mit Proxy
npm run lint      ESLint und Prettier
npm run typecheck tsc für App und Tests
npm test          Vitest
npm run test:ci   Vitest einmal, mit Abdeckung und Schwelle 90 %
npm run build     Produktionsbündel, mit Budgets
```

## Aufbau

```
src/app/core/     theme, i18n, api, config, kacheln, layout
src/app/map/      MapLibre hinter einem Adapter, wert://-Protokoll, Färbe-Worker
src/app/shell/    Navigation und Avatar um die Reiter
src/app/ui/       die gemeinsamen Bausteine aus CLAUDE.md
src/app/features/ die Reiter
src/app/dev/      /bausteine, nur in der Entwicklung
src/styles/       Maße der Pilzkarte und Hilfsklassen für das Kit
```

Ein Baustein steht genau einmal in `src/app/ui/`. Seiten setzen zusammen; sie
setzen keine Höhe, keinen Radius und keine Farbe eines Bausteins. Ein Maß, das
in zwei Bausteinen vorkommt, wird ein Token in `src/styles/_tokens.scss`.

## ui-kit

Das Kit liegt nicht auf npm. `vendor/stupa-makers-ui-kit-0.1.0.tgz` ist der
Bau des lokalen Klons:

```
cd ~/Workspace/ui-kit && npm ci && npm run build && cd dist && npm pack
cp stupa-makers-ui-kit-*.tgz <repo>/frontend/vendor/
```

Das Kit nennt Angular 20 als Peer. `overrides` in `package.json` hebt die drei
Angular-Pakete auf die Version der App. Die Vorlagen des Kits benutzen
Tailwind-Klassen; `src/styles/_kit-hilfsklassen.scss` liefert genau die
benutzten Klassen aus den Token-Werten des Kits nach, damit die App ohne
Tailwind auskommt.

## Proxy

`proxy.conf.json` führt `/api` auf das lokale Backend (Port 8111) und die
Kachelpfade auf `pilze.beimgraben.net`. So braucht die Entwicklung kein
eigenes Rendering. Die Pfadformen und die Arten mit Vorhersage stehen in
`src/app/core/kacheln/kachel-pfade.ts`.

Die Tests laufen isoliert (`isolate` im `test`-Ziel). Ohne Isolierung teilen
sich alle Testdateien eine Umgebung; die Vorgaben aus `src/test-setup.ts`
greifen dann nur für die erste Datei, und die Sprache der Oberfläche wechselt
mitten im Lauf.

## Die Karte

Der Hintergrund kommt von OpenFreeMap („liberty“ hell, „dark“ dunkel) und folgt
dem Theme. MapLibre liegt hinter `MapAdapter`; die Kartenseite kennt es nicht
und läuft in den Tests ohne WebGL.

Zwei Punkte, die MapLibre anders macht, als man erwartet:

- Es zählt Zoomstufen für 512er-Kacheln. Die Wertkacheln sind 256 Punkte breit,
  ihre Stufe 5 ist hier die 4.
- `load` und `idle` bleiben auf dieser Karte aus. Der Wochenwechsel hört darum
  auf `sourcedata` der neuen Quelle und hat eine Frist als Notbremse.

### `wert://`

Eine Rasterquelle mit der Vorlage `wert://<quelle>/<ordner>/{z}/{x}/{y}`. Jede
Quelle meldet sich einmal an, mit ihrer Skala, ihrer Rampe und der Liste der
Kacheln, die Daten tragen: was dort fehlt, wird nie geholt und kommt leer
zurück, ohne 404. Alles andere geht an einen Worker. Der holt das PNG (ein Byte
je Punkt), färbt es über eine Nachschlagetabelle und schickt ein `ImageBitmap`
zurück. Die rohen Bytes bleiben im Worker, begrenzt auf 16 MB; die
Nachbarwochen liegen so schon da, bevor jemand sie wählt.

Zwei Skalen gibt es. Eine Art trägt ihren Höchstwert `top`, färbt absolut und
lässt die Deckkraft mit dem Wert laufen. Eine Eingabe-Ebene trägt ihre Spanne
`low` bis `high` in ihrer Einheit, spannt die Rampe darüber und bleibt gleich
deckend; sonst sähe ein niedriger pH aus wie fehlende Daten.

### Kombination

Die Kombination ist dasselbe Protokoll mit mehreren Quellen. Der Worker holt
die Kacheln aller angehakten Faktoren, prüft je Punkt jede Bedingung und
liefert eine Kachel. Die Schnittmenge färbt in einer Farbe, halb deckend, wo
jede Bedingung zutrifft. Abgestuft nimmt das geometrische Mittel der
Erfüllungsgrade; ein Grad fällt außerhalb der Bedingung linear über ein
Zehntel der Skala auf null, damit sichtbar bleibt, wo es knapp ist. Fehlt einer
Quelle der Punkt, bleibt der Punkt leer.

Eine Vorhersage-Art taugt als Faktor: `ebeneAusArt` bringt sie in die Form
einer Ebene. Beide tragen Skala, Kachelordner je Woche und ein Histogramm,
also führt nur ein Weg durch die Anwendung.

### Rollen

Zwei Wertebenen liegen übereinander: `vorhersage` unten, `ebene` darüber. Jede
Rolle hat eigene Quellen, eine eigene Deckkraft und ihren eigenen Wechsel ohne
Flackern.

## Werkstattseite

`/bausteine` zeigt jeden Baustein einmal hell und einmal dunkel. Die Route
gibt es nur in der Entwicklung. Die Bilder in `docs/` sind der Stand bei der
Abnahme von A1.
