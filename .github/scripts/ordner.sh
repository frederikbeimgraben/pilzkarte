#!/usr/bin/env bash
# Meldet als Ausgabe "da", ob der Ordner eines Arbeitspakets schon im Baum
# liegt. Fehlt er, endet der Job grün: der Branch-Schutz auf main soll alle
# sieben Prüfungen verlangen können, bevor A0 und A1 gemergt sind.
set -euo pipefail

marke=$1
ordner=$2
paket=$3

if [ -f "$marke" ]; then
  echo "da=true" >>"$GITHUB_OUTPUT"
else
  echo "da=false" >>"$GITHUB_OUTPUT"
  echo "::notice::$ordner/ fehlt noch, Paket $paket ist nicht gemergt. Dieser Job endet ohne Prüfung."
fi
