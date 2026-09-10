# PMTiles-Archiv für die Offline-Karte

`deutschland.pmtiles` liegt unter
`https://pilze.beimgraben.net/karte/deutschland.pmtiles`. Die App holt daraus
je Gebiet die Kacheln über HTTP-Range und legt sie in IndexedDB ab (F2b).
Caddy liefert Range-Requests über `file_server`, siehe `docs/betrieb.md`.

```
./bauen.sh        # baut arbeit/deutschland.pmtiles, dauert rund eine Stunde
./hochladen.sh    # rsync nach /var/www/pilze/karte, dann Range- und Show-Probe
```

Beide Skripte holen ihre Werkzeuge über `nix run`: `jdk21` für Planetiler und
`pmtiles` für die Proben. Planetiler steht nicht in nixpkgs; `bauen.sh` lädt
das Jar der festen Fassung und prüft die SHA-256-Summe.

## Quelle

Die Kacheln entstehen aus dem Geofabrik-Extrakt für Deutschland, gebaut mit
[Planetiler](https://github.com/onthegomap/planetiler) im Profil
OpenMapTiles. Die Aufrufliste in `bauen.sh` ist die von OpenFreeMap
(`tilegen/tilegen_lib/planetiler.py`), nur mit `--area=germany`. Damit tragen
die Kacheln dasselbe Schema und dieselben Felder wie die Online-Karte, und die
Stile „liberty“ und „dark“ zeichnen offline wie online.

Zwei Wege wurden verworfen:

- **Download bei OpenFreeMap.** OpenFreeMap bietet nur den ganzen Planeten an,
  als Btrfs-Abbild oder MBTiles, und verlangt dafür 300 GB. Es gibt kein
  PMTiles und keinen Auszug für ein Land. Ein `pmtiles extract` braucht aber
  ein PMTiles-Archiv auf der Gegenseite.
- **Protomaps.** Die täglichen Planet-Builds erlauben `pmtiles extract --bbox`
  und wären der kürzeste Weg. Protomaps hat aber ein eigenes Schema und einen
  eigenen Stil. Die App hätte dann offline eine andere Karte als online, oder
  das Frontend müsste den Stil wechseln.

## Lizenz und Attribution

| Teil | Lizenz |
| --- | --- |
| Kartendaten (OSM-Extrakt, Wasserflächen, Seelinien) | ODbL 1.0 |
| Natural Earth (Grenzen und Orte in kleinen Zoomstufen) | Public Domain |
| Schema OpenMapTiles | BSD-3-Clause |
| Planetiler | Apache-2.0 |
| Stil „liberty“ und „dark“, Sprites, Schriften | OpenFreeMap, MIT |

Die ODbL verlangt einen Hinweis auf die Quelle. Die Karte trägt online wie
offline dieselbe Zeile:

```
Stil: OpenFreeMap · © OpenMapTiles · Daten © OpenStreetMap-Mitwirkende
```

Offline stammen nur die Kacheln aus diesem Archiv. Stil, Sprites und
Schriften kommen weiter von OpenFreeMap; der Service Worker hält sie vor.

## Erneuerung

Der Untergrund ändert sich langsam: ein neuer Waldweg oder ein neues Gebäude
ändert nichts an einer Vorhersage. Zwei Läufe im Jahr reichen, am besten vor
der Saison im Frühjahr und im Spätsommer.

Ein neuer Lauf braucht einen frischen OSM-Extrakt. `bauen.sh` behält die
Quellen, damit ein zweiter Versuch die 5 GB nicht noch einmal zieht; für eine
neue Fassung darum erst löschen:

```
rm tools/pmtiles/arbeit/data/sources/germany.osm.pbf
./bauen.sh && ./hochladen.sh
```

`hochladen.sh` schreibt ohne `--delete` und benennt am Ziel um. Ein Client,
der gerade lädt, sieht darum entweder das alte oder das neue Archiv. Ein
Gebiet, das schon in IndexedDB liegt, bleibt gültig, bis der Nutzer es unter
Konto, Offline aktualisiert.
