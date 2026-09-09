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
src/app/core/     theme, i18n, api, config, kacheln
src/app/ui/       die gemeinsamen Bausteine aus CLAUDE.md
src/app/features/ die Reiter, in A1 noch Platzhalter
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

## Werkstattseite

`/bausteine` zeigt jeden Baustein einmal hell und einmal dunkel. Die Route
gibt es nur in der Entwicklung. Die Bilder in `docs/` sind der Stand bei der
Abnahme von A1.
