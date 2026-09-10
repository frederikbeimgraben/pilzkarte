# Backlog

Vorgemerkte Arbeit, noch ohne Paket in `docs/arbeitspakete.md`. Was hier
steht, ist entschieden, aber nicht eingeplant.

## Wetter

- [ ] **Wettervorhersage einarbeiten.** Die Kette rechnet heute nur mit
      gemessenem Wetter (DWD HYRAS). Eine freie Vorhersage (DWD ICON,
      MOSMIX oder Open-Meteo) als weitere Quelle laden, für die kommenden
      Tage bis zwei Wochen. Daraus je Woche dieselben Ebenen wie heute,
      damit Niederschlag und Temperatur der Zukunft unter Ebene und als
      Faktor der Kombination verfügbar sind. Kennzeichnung als Prognose in
      `layers.json`.
- [ ] **Vorhersage-Horizont mit dem Wetter erweitern.** Heute rechnet das
      Modell zwei Horizonte: 0 und 2 Wochen, wobei Horizont 2 ohne
      Wetterwerte der Zielwoche auskommen muss. Mit einer Wettervorhersage
      als Eingabe kann Horizont 2 dieselben Wetterspalten sehen wie
      Horizont 0, und ein Horizont 3 oder 4 wird möglich. Zu prüfen:
      Fehler der Vorhersage gegen den Gewinn, Kalibrierung je Horizont.
      Anmerkung: Das Modell ist ein LightGBM-Booster mit isotoner
      Kalibrierung, kein LSTM.

## Karte

- [ ] **Auflösung von Ebene und Kombination beim Zoomen.** Beide Ebenen
      bleiben beim Hineinzoomen grob, statt auf die feineren Kachelstufen
      zu wechseln. Zoomstufen der Quellen prüfen (`tiles.zooms` gegen
      `maxzoom` der Rasterquelle) und `maxzoom` je Quelle richtig setzen.
- [ ] **Legende der Kombination** steht über dem Schalter Schnittmenge
      und Abgestuft. Sie gehört darunter, direkt an die Karte.

## Arten

- [ ] **Gruppen verwechselbarer Arten.** Arten, die einander ähneln, im
      Datenmodell zu einer Gruppe verbinden. Je Gruppe die
      Unterscheidungsmerkmale aus 123pilzsuche herausschreiben und eine
      Matrix der Reagenzien-Reaktionen anlegen, damit man zwei Arten Zeile
      für Zeile vergleichen kann. Eigene Ansicht je Gruppe.

## Vorgehen

- [ ] **Mockups vor der Umsetzung.** Für neue Ansichten (Gruppen,
      Reagenzien-Matrix, Taxonomie) erst Artboards im Design-Canvas, dann
      Umsetzung.
