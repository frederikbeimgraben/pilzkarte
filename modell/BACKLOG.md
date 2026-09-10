# Backlog

Ideas for later, and the state of the work now.

**How this file grows.** Anything sent with `/queue` goes into **Queued** at
the top of this file. Items move from Queued into a theme below when work on
them starts. Nothing is deleted. A finished item keeps its line and gets a
result, because a negative result is worth as much as a positive one.

Status marks: `[ ]` open, `[~]` running, `[x]` done, `[!]` tried and failed.

---

## Queued

In dieser Reihenfolge.

1. - [x] Fuenf weitere Arten in einem Durchlauf, alle mit Oktober-Peak
        ausser wo vermerkt:
        Parasol (Macrolepiota procera, 5.064 Funde, beste Datenlage im
        Projekt), Nebelkappe (Clitocybe nebularis, 1.909 Besuche,
        89 % Konzentration, Peak KW 43, spaetester im Satz), Schopftintling
        (Coprinus comatus, 1.576, 89 %, Wegraender statt Wald und damit ein
        Test, ob das Modell ausserhalb des Waldes traegt), Flaschenbovist
        (Lycoperdon perlatum, 1.845, 76 %) und Buchen-Schleimruebling
        (Mucidula mucida, 1.141, 89 %, streng an Buche und damit ein harter
        Test fuer die Baumartenfeatures).
2. - [x] Eingabe-Layer auf der Karte sichtbar machen: Wetter, Boden, Gelaende,
        Geologie, Baumarten einzeln zuschaltbar, nicht nur das Ergebnis.
3. - [x] Seite fertig machen und auf den Homeserver bringen. Steht seit
        2026-09-06 unter pilze.beimgraben.net. Der Job, der laufend weitere
        Wochen rendert, steht seit 2026-09-07: `homeserver-pilze-render`,
        montags 03:30, rechnet auf dem Server selbst und schreibt die Kacheln
        ein Verzeichnis weiter in den Webordner. Vorher rechnete die
        Arbeitsmaschine und schob 563 MB durch den Tunnel.
        Damit er auf 16 GB neben ClickHouse und Minecraft passt, musste der
        Renderlauf abspecken. Gemessen, in dieser Reihenfolge:
        Ausgangslage 9,02 GB; nur gebrauchte Spalten einlesen (Baumanteile
        59 auf 17) 9,02 GB, also wirkungslos; Zelle als Kategorie statt
        Zeichenkette 8,49 GB; **Wettertabelle vor add_lags zuschneiden
        3,84 GB**. Der Grund: add_lags legt 32 Spalten ueber 9,9 Millionen
        Zeilen an und haelt sie dreifach, waehrend eine Karte die Lags nur
        fuer die gezeichneten Wochen braucht. Den vollen Zeitraum braucht
        allein die Anomalie, und davon nur das Mittel je Zelle und
        Kalenderwoche. Ueber 90 Wochen: 5,42 GB statt 9,02, zehn Minuten je
        Art. Gegenprobe: alle 7.470 Kacheln byteweise identisch, Bezugswert
        gleich bis auf neun Stellen.
        Dabei zwei Fehler in `update.sh` gefunden, beide aelter:
        der Schopftintling waere mit der Waldmaske von 3 Prozent gerendert
        worden, die ihn genau dort ausblendet, wo er waechst; und
        `--cells-from` haette den Wetterbestand von 14.980 auf die 12.502
        Zellen mit Fundmeldung zusammengestrichen — die Karte spart alles
        ohne Wetterzelle als Ausland aus, also waeren 17 Prozent der Flaeche
        nach der ersten Auffrischung verschwunden.
        Ausserdem zieht `extract_grids.py` mit `--refresh-from` nur noch das
        laufende Jahr nach statt ab 2014. Der Server braucht damit 2,2 GB
        statt des 6,3-GB-HYRAS-Archivs. Gegenprobe: Tabelle elementweise
        identisch, groesste Abweichung 0.
        Offen als Folgeschritt: den Bezugswert je Art auf die
        Kalibrierungsdecke festnageln. Dann fallen die gehaltenen
        Wochenfelder weg (weitere 836 MB), und der woechentliche Lauf koennte
        nur die neuen Wochen rechnen statt aller 90. Acht der elf Arten
        liegen ohnehin schon auf ihrer Decke, drei knapp darunter. Zuletzt: Seite fertig machen und auf den Homeserver bringen. Layer
        an- und abwaehlbar. So weit vorbereiten, dass Frederik sie selbst
        hostet und Bekannten schicken kann. Dazu ein Job, der laufend weitere
        Wochen rendert. NixOS-Modul plus Reverse Proxy von beimgraben.net auf
        pilze.beimgraben.net. Der CNAME ist bereits angelegt (Stand
        2026-09-06), also nur noch Reverse Proxy und Zertifikat.
        Die NixOS-Config erst ansehen, wenn dieses Item
        an der Reihe ist. Stil: schlicht, kurz, keine langen Hinweistexte.
        Quellen nennen, damit die Lizenzen eingehalten sind: GBIF mit DOI,
        DWD, Thuenen, SoilGrids, Copernicus DEM, BGR, OpenStreetMap.
        Dabei die Uebertragung umstellen: statt fertig eingefaerbter
        RGBA-PNG ein einkanaliges Graustufen-PNG je Woche, das nur den Wert
        traegt. Der Browser liest es in ein Canvas und faerbt selbst ein.
        Gemessen an 265.895 Zellen: RGBA 14 kB, einkanalig 9 kB, dieselben
        Werte als JSON 1.001 kB und gzip 9 kB. Ein PNG ist also bereits die
        kompakte Werteuebertragung; JSON bringt nichts ausser Parse-Arbeit.
        Damit werden Farbskala, Deckkraft und Schwellwert Sache des Browsers
        statt eines Neu-Renderns von 540 Bildern, der Wert wird beim Klick
        abfragbar, und "nur ueber X anzeigen" wird moeglich. Zusammen mit der
        Umstellung auf Kacheln machen. 8 Bit reichen: 256 Stufen auf 0 bis 1.
        Dazu Kachelpyramide statt Vollbild, sonst traegt Deutschland im
        500-m-Raster nicht. Gerechnet fuer 51 Grad Nord: z7 gibt 770 m/px und
        20 Kacheln fuers Land, z8 gibt 385 m/px und 63. Bei 500-m-Daten ist z8
        die sinnvolle Obergrenze, alles darueber skaliert Leaflet per
        maxNativeZoom selbst hoch. Pyramide z5 bis z8 sind 91 Kacheln je Woche
        und Art, also 49.140 Dateien und rund 393 MB. Ein Ausschnitt laedt
        dann 6 bis 12 Kacheln, also 50 bis 100 kB je Wochenwechsel, statt
        250 kB fuer ein Vollbild — und das unabhaengig von der Zoomstufe.
        Die Kacheln werden per XYZ-Schema abgerufen, das kann jeder
        Webserver ohne eigene API ausliefern.
        **Erledigt 2026-09-07.** `tiles.py` schneidet z5 bis z8, ein Byte je
        Punkt, leere Kacheln entfallen. `build_page.py` faerbt im Browser
        ueber eine Nachschlagetabelle auf Canvas. An einem Deutschlandbild
        gemessen: RGBA 1373 kB, Palette 802 kB, ein Kanal 420 kB. Der
        Kachelsatz einer Woche wiegt 1300 kB, spart also beim Speicher
        nichts — der Gewinn liegt im Abruf: Uebersicht 93 kB statt 1745 kB
        (19x), ganzes Land bei z7 306 kB (5,7x), hineingezoomt am Telefon
        rund 125 kB (14x). Ein Saisondurchlauf faellt von 124 MB auf 8,4 MB.
        Gegenprobe Kachel gegen Vollbild am selben Ausschnitt: mittlere
        Farbabweichung 0,20 von 255, Deckkraft identisch.

4. - [x] Karte auf ganz Deutschland erweitern. **Fertig 2026-09-07, live.**
        11 Arten mal 90 Wochen als Kacheln: 82.260 Kacheln, 563 MB, elf
        Minuten Rechenzeit je Art. Dazu 15 Eingabe-Ebenen mit je 84 Kacheln.
        Belegte Stufen je Woche: z5 vier, z6 sechs, z7 siebzehn, z8
        sechsundfuenfzig. Abruf je Woche fuers ganze Land: 13 kB bei z5,
        43 kB bei z6, 134 kB bei z7; hineingezoomt am Telefon 12 kB. Zum
        Vergleich 1373 kB je Vollbild, unabhaengig vom Zoom.
        Die Hoechstwerte steigen nur dort, wo die Kalibrierungsdecke noch
        Luft liess: Nebelkappe 0,573 auf 0,602, Parasol 0,536 auf 0,577,
        Flaschenbovist 0,461 auf 0,466, Birkenpilz 0,205 auf 0,216. Die
        anderen sieben sassen schon in Baden-Wuerttemberg an ihrer Decke.
        Mehr Flaeche heisst also nicht mehr Zuversicht. Die 500-m-Baumkarte deckte das
        Land schon ab, das Wetter ebenso: 14.980 Zellen ueber 640 mal 870 km.
        Das Raster waechst von 256.122 auf 2.322.285 Zellen.
        Dabei zwei Fehler gefunden und behoben:
        `--region bw` griff seit dem Wechsel auf den nationalen Baum-Cache
        nicht mehr, und 58.500 der 2.322.285 Zellen trugen `gx`/`gy` aus dem
        Ursprung ihrer Bau-Kachel statt aus dem des Landes — 2,5 Prozent des
        Landes lagen im Bild an der falschen Stelle. Beide Male ist die Lage
        jetzt aus x und y neu bestimmt statt gespeichert.

5. - [x] Modell ohne neue Funddaten verbessern, nach dem Sanity-Check vom
        2026-09-07. **Fertig 2026-09-07, alle elf Arten neu.** Ergebnis
        mit Jahresfalten, Horizont 0 (Rueckschau) und Horizont 2 (Prognose),
        Features nach der Auswahl, Deckel aus der Kalibrierung:

        | Art | Besuche+ | h0 Feat. | h0 AUC | h0 AP | h2 Feat. | h2 AUC | Deckel |
        |---|---|---|---|---|---|---|---|
        | Steinpilz | 1853 | 103 | 0,868 | 0,336 | 40 | 0,861 | 0,50 |
        | Pfifferling | 799 | 25 | 0,904 | 0,266 | 80 | 0,905 | 0,29 |
        | Birkenpilz | 669 | 60 | 0,844 | 0,170 | 40 | 0,836 | 0,20 |
        | Reizker | 1080 | 20 | 0,890 | 0,337 | 30 | 0,888 | 0,38 |
        | Hexen, flockig | 957 | 88 | 0,877 | 0,293 | 50 | 0,871 | 0,31 |
        | Hexen, netzig | 525 | 25 | 0,921 | 0,270 | 50 | 0,922 | 0,26 |
        | Parasol | 2199 | 80 | 0,843 | 0,343 | 50 | 0,832 | 0,55 |
        | Nebelkappe | 2448 | 76 | 0,897 | 0,436 | 60 | 0,897 | 0,60 |
        | Flaschenbovist | 2242 | 80 | 0,822 | 0,331 | 50 | 0,816 | 0,48 |
        | Schleimruebling | 1527 | 50 | 0,892 | 0,344 | 40 | 0,891 | 0,38 |
        | Schopftintling | 2614 | 20 | 0,827 | 0,277 | 74 | 0,831 | 0,41 |

        Vergleich mit frueheren Messungen auf derselben Tabelle (46.554
        Besuche, Satz "best" in visit_model.py): Steinpilz 0,856 auf 0,868
        Jahres-AUC, Nebelkappe 0,898 auf 0,897. Die aelteren Zahlen der
        anderen Arten stammen aus Laeufen mit mindestens 3 Arten je Besuch
        und sind nicht vergleichbar. Der Gewinn kommt aus Lag 0 und 1, den
        Summen und Anomalien, die das Horizont-0-Modell jetzt lesen darf,
        und aus dem Prior; die Prognose selbst (h2) liegt einen halben
        AUC-Punkt darunter, ist aber jetzt ohne Leck. Die
        Validierung an ausgelassenen Besuchen: ein echter Fund liegt im
        Median auf dem 76. bis 84. Perzentil seiner Woche, und beim
        Bezugsaufwand von 3 bis 5 Arten trifft die Vorhersage die
        beobachtete Rate in KW 36 bis 44 auf zwei Tausendstel (Steinpilz
        0,056 gegen 0,058, Parasol 0,072 gegen 0,070, Nebelkappe 0,059
        gegen 0,060, Pfifferling 0,015 gegen 0,014).
        Beim Neubau selbst noch ein Fehler gefunden, von mir eingebaut und
        vor dem Deploy gefangen: die Karte gab LightGBM die Spalten in der
        Reihenfolge der Feature-Liste, trainiert war aber mit den
        Prior-Spalten am Ende. LightGBM liest nach Position. Die Karte lag
        dadurch bei einem Drittel der richtigen Werte; jetzt liest sie die
        Reihenfolge aus dem Modell. Dazu die Wochenschleife auf numpy
        umgebaut, die Vorhersage gestueckelt und die Wochenfelder nicht
        mehr gehalten (Hoechstwert der Kacheln ist jetzt der Deckel): Spitze
        je Art von 6,7 bis 7,2 GB auf 4,1 bis 5,3 GB, Ergebnis byteweise
        gleich. Der Steinpilz mit 103 Spalten ist mit 5,30 GB der teuerste
        und bleibt unter der 6-GB-Bremse des Homeservers. Ausserdem
        gefunden: `week_id` springt am Jahreswechsel um zwei, also die
        letzten 90 Wochen ueber die Menge der Wochen waehlen, nicht ueber
        `max - 90`; sonst fehlt eine Woche.
        Vier Befunde, alle gemessen, nicht vermutet:
        (a) Die Aktivitaetsrate wurde in `visit_model.py` und `region_map.py`
        verschieden gerechnet: Beobachter-Tage gegen eindeutige Beobachter,
        Treffer-Tage gegen Fund-Datensaetze, Fensterende Vortag gegen
        Montag. An 4.000 Herbstbesuchen des Steinpilzes las die Karte 40 bis
        60 Prozent hoehere Werte als das Training (7 Tage: Mittel 0,048
        statt 0,035, Korrelation 0,64). Jetzt eine Klasse `ActivityFields`,
        die beide aufrufen, mit Fensterende am Vortag und halber Blockbreite
        Versatz korrigiert. (b) Das Horizont-2-Modell las `tas_drop_2w`
        (Temperatur der Zielwoche) und Aktivitaet bis zum Vortag; die
        Prognosewochen bekamen dafuer NaN und leere Fenster. Jetzt zwei
        Modelle je Art in einem Bundle: Horizont 0 fuer beobachtete Wochen
        mit allen Lags, Summen und Anomalien; Horizont 2 fuer die zwei
        Prognosewochen ohne `tas_drop` und mit um zwei Wochen
        zurueckgeschobenen Aktivitaetsfenstern. `region_map.py` waehlt je
        Woche. (c) Der Kalibrierdeckel wirkte nur nach dem Pickle-Umweg,
        siehe Models. (d) `validate_map.py` prueft jetzt ausgelassene
        Besuche statt der In-sample-Karte, siehe Models.
        Dazu eingebaut: Vorjahres-Prior je Zelle und Block (siehe Features),
        Feature-Auswahl auf den kleinsten Satz innerhalb 0,005 AP-Summe vom
        besten plus ein Kandidat aus allen Features mit mindestens 0,5
        Prozent Gewinn, ein Raster aus vier LightGBM-Einstellungen je
        Horizont, Gelaende, Boden und Geologie aus der Besuchstabelle
        gestrichen (Standort-Test: kein Gewinn bei drei Arten), `iso_week`
        nicht mehr doppelt im Wetter, Jahreswechsel der Prognosewochen ueber
        den Kalender statt week_id + 1.
        Auf der Karte: sieben Wochenebenen (Regen der Woche, 2, 4, 8 Wochen,
        Regen-Anomalie gegen 4-Wochen-Normal, Mittel- und Tiefsttemperatur),
        die mit dem Wochenregler mitlaufen, Kacheln z5 bis z7 weil das Wetter
        auf 5 km liegt; und die Trainingsfunde je Art als Punkte auf der
        Mitte ihrer 5-km-Zelle, Groesse nach Anzahl, Regler filtert auf die
        Kalenderwoche plus minus zwei ueber alle Jahre. Genaue Fundorte
        bleiben draussen (Projektregel fuer geschuetzte Arten).
        Nicht im Code geloest: der Meldeverzug, siehe Data sources.
        Neubau aller elf Arten 2026-09-07 10:16 bis 15:50, live seit 16:12.
        `deploy_daten.sh` spiegelt jetzt auch `reports/maps/funde/`,
        `layers.json` und `layers_kacheln/` mit, sonst verloere der
        Montagsjob auf dem Server die Funde und die festen Ebenen beim
        Spiegeln in den Webordner. `update.sh` rechnet die Wochenebenen mit
        (`input_layers.py --only-weekly`) und raeumt ihre alten Wochen weg.

6. - [x] App mit Server: Funde melden und Ebenen von Hand verbinden.
        **Gebaut 2026-09-08.** Drei Teile.
        (a) `src/pilze/api.py`, nur Standardbibliothek, eine SQLite-Datei:
        status, anmelden, funde GET/POST/DELETE unter /api/. Ein
        Zugangscode fuer den ganzen Kreis, beim ersten Start erzeugt und
        ins Journal geschrieben; ohne ihn ist die Karte lesbar, mehr nicht.
        Funde sind genaue Orte und nur mit Code sichtbar, das haelt die
        5-km-Regel fuer geschuetzte Arten. Der Prozess beendet sich, wenn
        rsync die Datei ersetzt, systemd startet ihn neu.
        (b) Die Seite als PWA: Manifest, Icons, Service Worker. Huelle
        zuerst aus dem Netz, Kacheln zuerst aus dem Cache (Grenze 4000),
        Hintergrundkarten mit Cache als Rueckfall, die API nie. "Fund
        melden" mit Marke per Tipp oder GPS, Formular, Warteschlange im
        Browser fuer den Wald ohne Netz, gemeldete Funde als orange Marken
        je Art, loeschbar. (c) Tab "Kombination": Vorhersage und jede
        Eingabe-Ebene waehlbar, je Ebene Richtung (mehr oder weniger ist
        besser) und Gewicht 1 bis 3, verbunden als geometrisches Mittel,
        Minimum oder gewichtetes Mittel. Das rechnet der Browser je Kachel
        aus den Wertkacheln; Wochenebenen mit z7 werden aus der
        Elternkachel hochgezogen. Eine Ebene ohne Daten macht den Punkt
        leer.
        NixOS: `homeserver-pilze-api` (Dienst, Zustand unter
        /var/lib/pilze-api, reverse_proxy /api/* auf dem pilze-vhost),
        Port 8111, sw.js und Manifest ohne Cache. Der Switch auf dem
        Homeserver bleibt Handarbeit.
        Nicht gebaut: Fotos zu Funden, Konten je Person, eine Karte der
        Funde fuer Leute ohne Code.

7. - [x] Neues Layout und Katalog. **Gebaut 2026-09-08.** Die Seite ist
        jetzt in drei Dateien unter `src/pilze/web/` und in vier Seiten
        geteilt: Karte, Arten, Funde, Info, mit einer Navigation, die am
        Telefon unten und am Rechner oben in der linken Spalte sitzt. Am
        Telefon ein Blatt von unten mit drei Rasten, am Rechner eine Spalte
        von 390 px neben der Karte. Die Woche ist eine Zeitleiste aus
        Knoepfen mit Jahresmarke, Prognose gestrichelt und dem Saisonbalken
        der Art darunter, statt eines Schiebereglers. Arten sind Chips.
        Fund melden geht ueber ein Fadenkreuz in der Kartenmitte: Karte
        schieben, "Hier ist es", Formular im Dialog; GPS als Abkuerzung.
        Die Fundliste zeigt alle gemeldeten Funde mit Filter nach Art und
        "nur meine", ein Tipp springt zur Karte. Hell und dunkel nach
        Systemeinstellung.
        Katalog in `katalog.py`: elf Profile mit Erkennen, Wo, Saison aus
        den Trainingsfunden, Verwechslung, Schutz und Links. Die Texte sind
        fuer dieses Projekt geschrieben; 123pilzsuche.de wird verlinkt, wo
        eine Seite auffindbar war (acht Arten), sonst Wikipedia. Deren
        Inhalte sind nicht kopiert, dazu haette ich kein Recht.
        Nachgezogen am selben Abend nach Frederiks Blick aufs Telefon:
        die Kartenseite ist jetzt hierarchisch, erst die Ansicht
        (Vorhersage, Ebene, Kombination), darunter das, was zu ihr
        gehoert; die Art steht in der Vorhersage, in der Kombination
        wird die Art der Vorhersage-Ebene in der Liste gewaehlt, die
        Zeitleiste steht darunter fuer alle drei und verschwindet bei
        einer festen Ebene. Der Balken unter jeder Woche ist das Mittel
        der Karte dieser Woche relativ zur besten Woche der Art, nicht
        mehr die Saisonkurve der Trainingsfunde (die war im Herbst immer
        voll). `region_map.py` schreibt Mittel und Maximum je Woche ins
        Manifest, `week_stats.py` hat sie fuer die bestehenden Karten aus
        den z5-Kacheln nachgerechnet. Die Artenliste lief am Telefon ueber
        den Rand: ein Grid mit `1fr` laesst eine Karte so breit werden wie
        ihr laengster Name, `minmax(0, 1fr)` nicht.
        Am 2026-09-09 nach der naechsten Runde: die Zeitleiste ist der
        feste Kopf des Blatts und bleibt auch eingeklappt sichtbar, mit
        Art, Woche und den drei Knoepfen in einer Zeile; die Woche ist
        damit ohne Aufklappen erreichbar, und die schwebende Pille ueber
        der Karte entfaellt. Alle Hinweistexte auf eine Zeile gekuerzt
        oder gestrichen.
---

## Gestrichene Arten

Hier stehen sie, damit niemand sie versehentlich wieder aufnimmt. Der Grund
ist jedes Mal derselbe: zu wenige Besuche fuer ein eigenes Modell.

- [!] Sommersteinpilz (Boletus reticulatus), 405 Besuche. Das fertige Modell
      kam auf einen Deckel von 0,155 — selbst am besten Ort in der besten
      Woche etwa jeder sechste Gang. Ihn von Boletus edulis zu trennen war
      richtig, das Pooling kostete 0,7 AUC; die Datenmenge traegt aber kein
      eigenes Modell.
- [!] Semmelstoppelpilz (Hydnum repandum mit rufescens), 485 Besuche.
- [!] Totentrompete (Craterellus cornucopioides), 483 Funde. Falls die
      DGfM-Daten kommen, lohnt bei allen dreien ein neuer Blick.

## Running now

- [~] Tree species per cell from the Thuenen map, 10 m, 11 classes.
      Tile 61 of 234.
- [~] Bedrock geology per cell from the BGR map service. 3,250 of 12,502
      cells read. Gives rock, genesis and age.
- [~] Resolution sweep at 2 km and 10 km. 10 km is finished:
      AUC 0.829, AP 0.108 against a base rate of 0.022.

## Data sources

- [x] GBIF fungal records for Germany. 744,982 of 746,827, which is 99.8
      percent.
- [x] DWD HYRAS 1 km daily grids, six variables, 2010 to 2026.
- [x] DWD soil moisture per tree species, 0 to 30 cm, four species.
- [x] Copernicus DEM GLO-90, 94 tiles.
- [x] SoilGrids 250 m, eight properties at three depths.
- [x] OpenStreetMap extract for Germany, 4.6 GB.
- [ ] Send the request to the DGfM for pilze-deutschland.de. The draft is
      ready in `correspondence/01-dgfm-datenanfrage.md`.
- [ ] Send the request to Flora Incognita. The draft is ready in
      `correspondence/02-flora-incognita-datenanfrage.md`.
- [ ] Get a GBIF account and use the download API. It returns a full Darwin
      Core archive and a DOI to cite. The search API needs 2,500 requests and
      gives neither.
- [ ] ERA5-Land, to reach past the German border. It needs a free Copernicus
      account. Inside Germany the DWD grids are better.
- [ ] DWD ICON or MOSMIX forecast for the next 14 days. The forecast weeks
      run on the horizon 2 model, which drops lag 0 and lag 1 and every
      rolling sum; with a weather forecast they could run on the horizon 0
      model like every other week. This is the only way to bring the two
      forecast weeks up to the level of the weeks that already happened.
      ICON-EU on opendata.dwd.de reaches five days, ICON global 7.5 days;
      the second week would stay on the horizon 2 model.
- [ ] Reporting delay of GBIF. The activity features read the finds of the
      last three weeks, and at the time of rendering a part of those finds
      has not been uploaded yet. The record ends 2026-08-24 in the current
      download. Training sees the complete record, the live map does not.
      `gbif_fetch.py` now keeps `lastInterpreted`, so the next download can
      measure the delay per source; until then the weekly re-render of all
      90 weeks is what corrects the past weeks as the uploads arrive.

## Non-scientific sources

- [ ] Wikipedia page views, from the Wikimedia REST API. Open, daily, and
      about one day behind. Tested: the German article "Gemeiner Steinpilz"
      peaks in week 40, which is the observed peak of the species, and the
      weekly view count correlates with the weekly find count at r = 0.61 over
      175 weeks. "Maronen-Roehrling" swings 31 times between its median and its
      peak. This fixes the weak point of the activity nowcast, which reads
      GBIF and therefore arrives days to weeks late. National only: the API
      gives no split by state.
- [ ] Google Trends. The same idea, but it does split by state, so it fills
      the gap that Wikipedia leaves. No official API, the numbers are relative
      and not absolute, and bulk use sits against the terms of service.
- [ ] pilzforum.eu, still live, carries find reports. Unstructured text, and
      scraping needs permission.
- [ ] PSV year reports of the DGfM. A mushroom expert records how many people
      brought mushrooms for identification. That counts finds directly. Ask
      for these together with the mapping data.
- [ ] Where people actually walk: Strava or Komoot heat maps. Both restrict
      bulk use. The OpenStreetMap path density already on disk is the open
      substitute and serves the same purpose.
- [!] pilzticker.de is a parked domain with no content.

## Entscheidungen, gemessen

- [x] Besuchsfilter auf mindestens 2 Arten statt 3. Gemessen: 46.561 statt
      23.319 Besuche, AUC 0.8561 statt 0.8510, Vorsprung gegenueber der
      Zufallserwartung 7,5x statt 5,9x. Bei 5 Arten faellt die AUC auf 0.8255.
      Mehr Daten schlagen sauberere Abwesenheiten.
- [x] Bezugsaufwand auf der Karte: 4 Arten und 5 Funde je Gang, der Median
      aller Exkursionen. Die Skripte rendern seit dem Deutschland-Lauf damit;
      dieser Eintrag sagte noch 8. Der Wert verdoppelt beziehungsweise
      halbiert die Karte: bei 2 Arten liegt die mittlere Wahrscheinlichkeit
      bei 0.037, bei 8 bei 0.085, bei 20 bei 0.132. Gegen die ausgelassenen
      Besuche mit 3 bis 5 Arten stimmt der Median: in KW 36 bis 44 sagt das
      Modell 0,056, beobachtet sind 0,058 (Steinpilz, Stand 2026-09-07).

## Features

- [x] Lagged rain, temperature and soil moisture, 0 to 8 weeks.
- [x] Weather anomaly against the normal value of a cell in that week.
- [x] Prior-year features, which a forecast may use.
- [x] Terrain: slope, northness, eastness, and the topographic position index
      at 25 km and 55 km.
- [x] Soil: clay, sand, silt, pH, carbon, density, coarse fragments, nitrogen.
- [!] Soil moisture per tree species. No `paws` feature reached the top thirty
      by gain, as a raw value, as an anomaly or as a ratio. Retry once the
      tree species layer is in: the grid says what the soil moisture would be
      under a tree, but not which tree grows there.
- [ ] Effort proxies that a forecast can know: population density, distance to
      a road or a parking place, and the length of paths in the cell. The
      OpenStreetMap extract holds all three and no model uses it yet.
- [ ] Forest edge length from OpenStreetMap. Many species fruit at an edge,
      not inside a stand.
- [ ] Interaction between the host tree fraction and the soil moisture of that
      same tree. This is the test that the failed `paws` features deserve.
- [x] Distance to the nearest cell that holds the species, from earlier years.
      Done as a rate, not a distance: the share of visits that found the
      species in the same 5 km cell and in the same 25 km block, from the
      training rows of the fold only, leave-year-out for the training rows
      themselves. Steinpilz +0.005 AUC and +0.015 AP, Parasol +0.005 and
      +0.012, year folds. A cell nobody has visited reads n = 0 and no rate,
      which the model treats as neutral: forcing the prior to unknown raises
      the mean prediction, it does not darken unvisited land.
- [ ] Fix the DEM nodata leak. `dem_min` reaches -292 m, which cannot happen
      in Germany, so nodata enters the minimum resampling and spoils
      `dem_relief` for a few cells.
- [ ] HYRAS radiation is unused. It sits on a 5 km grid, not 1 km, and stops
      in 2020. Decide whether to drop it or to use it only up to 2020.

## Models

- [x] Gradient boosting with blocked folds by year and by region.
- [!] Pool a guild by genus. Seven bolete genera gave 12,243 positive
      cell-weeks instead of 2,895, but the AUC fell from 0.824 to 0.799.
      Pooling mixed species with different seasons and different hosts.
      Try a pool by host tree instead of by genus.
- [ ] The sequence model from the first idea: an LSTM or a temporal
      convolution over the raw weekly weather, instead of hand-built lags.
      Only after the gradient boosting model stops improving. The lag
      structure that the model found by itself is the thing to beat.
- [x] Calibration. Isotonic regression on a held-out quarter of the training
      rows, capped at the rate of the top two percent. The cap is a number in
      the bundle since 2026-09-07; before that it was set on the fitted curve,
      where sklearn ignores it until the object goes through pickle, so the
      printed calibration table showed the uncapped curve while the map used
      the capped one. `validate_map.py` now reads the out-of-fold predictions:
      Steinpilz decile 7 predicted 0.202, observed 0.209; a real find sits at
      the 79th percentile of its week's visits (median).
- [!] One model for many species at once, species as a category, same
      model size. Measured 2026-09-07 on the eleven species with year folds:
      worse for nine of them, Schleimruebling 0.889 to 0.872 AUC,
      Schopftintling 0.830 to 0.814, Parasol 0.836 to 0.823; only
      Flaschenbovist and Steinpilz level. A larger shared model might differ,
      but the naive version is off the table.
- [ ] Quantify the value of each data source by removing it, so that the next
      download decision rests on measurement.

## Products

- [x] Heat map of Boletus edulis for Tuebingen and for Kniebis in the Black
      Forest, 20 km around each, for the current week. Superseded by the
      national map, which covers both at 500 m. `heatmap.py` and `webmap.py`
      still sit in the tree but read the old bundle layout and the old tree
      columns; they can go, together with `run_species.sh` and `run_rest.sh`.
- [ ] A phenology curve for each species, as a return gift to the DGfM and to
      the state coordinators. This costs little and it is what a mapping
      society can use.
- [ ] Rules for anything public: a grid of 5 km or coarser, and no red-list or
      protected species. Boletus edulis and Cantharellus cibarius are
      protected under the Bundesartenschutzverordnung.

8. Umzug (2026-09-09). Die Kette lebt jetzt als `modell/` im Repo
   https://github.com/frederikbeimgraben/pilzkarte neben Frontend und
   Backend der App. Experimente und Einmal-Skripte (Auflösungs-Sweep,
   Masken, Nachbarn, `first_model`, `spatial_model`, `transfer`, `heatmap`,
   `webmap`) liegen in `~/Workspace/~Archived/Pilze-experimente`; ihre
   Ergebnisse stehen unter "Entscheidungen, gemessen". Die Kette liefert
   Kacheln, Manifeste, `funde/` und `layers.json`. Offen hier:
   - [x] C2 Histogramme je Ebene und Woche ins Manifest (`input_layers.py`,
         `region_map.py`, `week_stats.py`), Auftrag aus `arbeitspakete.md`.
         **Gebaut 2026-09-09.** 40 Klassen ueber die Skala des Eintrags, 41
         Kanten und 40 Anteile, gerechnet aus dem Feld statt aus den Kacheln:
         das Modellraster ist flaechentreu, also ist ein Anteil ein
         Flaechenanteil. Kosten 19,5 ms je Woche auf 2,32 Mio Punkten gegen
         rund 6,7 s Renderzeit je Woche, also 0,3 Prozent. Wochenebenen
         tragen ihre Histogramme in `histogramme` neben `weeks`, nicht in
         `weeks`: dort stehen die Wochenschluessel, nach denen `update.sh`
         die Kachelordner aufraeumt, und eine Liste von Objekten haette beim
         naechsten Lauf alle Kacheln geloescht. `week_stats.py` fuellt
         bestehende Manifeste aus den z5-Kacheln nach und laesst ein Mittel,
         das schon dasteht, unangetastet — das kam aus dem Feld und ist
         genauer. Die Manifeste wachsen: eine Art von 14 auf 78 kB,
         `layers.json` von 37 auf 494 kB (gzip 69 kB). Zahlenlisten stehen
         deshalb auf einer Zeile; mit `json.dumps(indent=1)` waere
         `layers.json` ueber 2 MB gross. `build_page.py` laesst die
         Histogramme aus der alten Seite heraus, `index.html` bleibt bei
         179 kB. `update.sh` bleibt unveraendert.
   - [x] C3 Mehr Wochenebenen. **Gebaut 2026-09-10.** Acht neue Ebenen fuer
         die Kombination, alle aus den DWD-Rastern, die schon auf der Platte
         liegen: Tage seit dem letzten Regen ueber 5 mm (gekappt bei 60),
         Hoechsttemperatur, Mitteltemperatur der letzten 2 und 4 Wochen,
         Frosttage, Hitzetage, Luftfeuchte und Bodenfeuchte. Damit sind es 15
         Wochenebenen und 15 feste.
         Drei davon sind Fragen an den Tag, die keine Wochenreduktion
         beantwortet: die Wochentabelle haelt Summe, Mittel, Minimum und
         Maximum, und die Zahl der Frosttage steht in keinem davon.
         `tagesmasse.py` rechnet sie auf dem Tagesraster, `extract_grids.py`
         reduziert sie danach wie jede andere Groesse. Die drei Spalten
         heissen `regen_tage_seit`, `frosttage` und `hitzetage` — kein
         `_lag`, `_sum`, `_mean`, `_anom` oder `_ratio` im Namen, also nimmt
         `visit_model.py` sie nicht als Feature auf und das Training bleibt,
         wie es ist. Das Nachrechnen ueber 2014 bis 2026 kostete gut zwei
         Minuten je Groesse (Zeitstempel der Zwischenspeicher: 19:42:08,
         19:44:21, 19:46:13) und legte drei Dateien unter
         `data/interim/weekly/` an; danach zieht `update.sh` sie mit
         `--refresh-from` wie alles andere nach.
         Die Renderzeit war das Problem. Acht Ebenen mehr kosteten 66 Prozent
         mehr, die Abnahme laesst 30 zu. Gemessen an zwei Wochen, CPU-Zeit mit
         Kindprozessen, Median aus drei Laeufen: 7 Ebenen 55,1 s, 15 Ebenen
         einzeln gewarpt 91,7 s. Der Start von gdalwarp ist das meiste davon
         (ein Lauf 0,3 s, ein weiteres Band darin 0,04 s), also je Woche ein
         Quellbild mit einem Band je Ebene und drei Laeufe fuer alle fuenfzehn:
         **60,6 s, plus 10 Prozent.** Fuer den Montagslauf ueber 90 Wochen
         heisst das 12 statt 15 Minuten, mit mehr als der doppelten Zahl an
         Ebenen.
         Die Artkacheln bleiben byteweise gleich (Gegenprobe: eine Woche
         Steinpilz, 83 Kacheln). Die Wochenebenen weichen an 0,1 Prozent der
         Punkte um eine von 255 Stufen ab, weil gdalwarp mit fuenfzehn
         Baendern anders stueckelt — unter der Genauigkeit eines
         5-km-Wetterfeldes auf 770-m-Punkten.
         Offen als Folgeschritt: die Rampe je Ebene. Alle Ebenen teilen sich
         heute die Farbrampe der Vorhersage und unterscheiden sich nur in
         `low` und `high`. Fuer die Regenanomalie waere eine zweiseitige
         Rampe richtig, fuer Frost- und Hitzetage eine mit acht Stufen. Das
         ist eine Absprache mit dem Frontend, kein Alleingang der Kette.
   - [ ] Begehungstabelle als Parquet-Export für die Saisonkurve der App.
   - [ ] `src/pilze/api.py`, `build_page.py`, `web/`, `katalog.py` fallen
         weg, sobald die App den Reiter Arten und das Melden übernimmt.
   - [ ] NixOS: `homeserver-pilze-api` ist durch `homeserver-pilze-app`
         ersetzt (uncommitted in `~/.nixos-config`, Frederik switcht).

## Open questions

- [ ] What resolution can the data carry? The sweep will answer this. The
      coordinates support about 250 m, because the 90th percentile of the
      coordinate error is 250 m. The record count does not: the median 5 km
      cell holds nine records, and Boletus edulis has a median of one record
      per cell.
- [ ] How much does the concentration of effort bias the result? The top one
      percent of cells hold 21 percent of all records.
- [ ] Does the target-group background hold for a species that people seek
      more than the background species? Somebody who hunts Steinpilze walks
      past other mushrooms without reporting them.
