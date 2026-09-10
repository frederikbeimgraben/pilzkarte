# Brett

Ein Brett für die Arbeit an der Pilzkarte. Es läuft auf diesem Rechner und
horcht auf `127.0.0.1:8123` und `10.66.66.5:8123`, also auch im Tunnel.

```
python3 tools/board/board.py
```

Der Speicher ist eine JSON-Datei unter
`~/.local/state/pilzkarte-board.json`. Sie wird atomar geschrieben.

## Spalten

`backlog`, `bereit`, `arbeit`, `pruefung`, `fertig`.

## Für Agenten

Eine Karte anlegen:

```
curl -sX POST http://127.0.0.1:8123/api/cards \
  -d '{"titel":"B3 Wochenleiste wischbar","spalte":"arbeit","paket":"B3","agent":"karte"}'
```

Eine Karte weiterschieben oder ergänzen:

```
curl -sX PATCH http://127.0.0.1:8123/api/cards/17 \
  -d '{"spalte":"pruefung","pr":"https://github.com/frederikbeimgraben/pilzkarte/pull/45"}'
```

Felder: `titel`, `spalte`, `paket`, `agent`, `notiz`, `marke`, `pr`.

Regel für Agenten: Beim Start eines Pakets die eigene Karte auf `arbeit`
setzen und den eigenen Namen in `agent` schreiben. Beim PR auf `pruefung`
mit der Adresse des PR. Wer einen Befund findet, den er nicht selbst
behebt, legt eine Karte in `backlog` mit `marke: Befund` an.
