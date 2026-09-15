#!/usr/bin/env node
/** Prüft, ob jeder Board-Stem einen Test oder einen Pending-Eintrag hat. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUDED = new Set(['SpecLevels']);
const EXPECT_BOARD = /expectBoard\(\s*[^,]+,\s*['"]([^'"]+)['"]/g;
// Die Karte prüft über eine eigene Hilfsfunktion; `guard` nennt dort das Board.
const GUARD = /guard\(\s*['"]([^'"]+)['"]/g;

/** Liest die Board-Stems aus den PNG-Dateien in `dir`. */
function baselineStems(dir) {
  return new Set(
    readdirSync(dir)
      .filter((name) => name.endsWith('.png'))
      .map((name) => name.slice(0, -4))
      .filter((stem) => !EXCLUDED.has(stem)),
  );
}

/** Liest die Board-Stems aus den `expectBoard`-Aufrufen unter `dir`. */
function testedStems(dir) {
  const stems = new Set();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.spec.ts')) continue;
    const text = readFileSync(join(dir, name), 'utf8');
    for (const match of text.matchAll(EXPECT_BOARD)) stems.add(match[1]);
    for (const match of text.matchAll(GUARD)) stems.add(match[1]);
  }
  return stems;
}

/** Liest die Stems aus `pending.json` unter `dir`. */
function pendingStems(dir) {
  return new Set(JSON.parse(readFileSync(join(dir, 'pending.json'), 'utf8')));
}

/** Vergleicht die Ausschnitte der Bausteine mit `blocks-cards.json`. */
function checkCards(dir, pending) {
  const manifest = JSON.parse(readFileSync(join(dir, 'blocks-cards.json'), 'utf8'));
  const wanted = manifest.map((card) => card.stem);
  const found = baselineStems(join(dir, 'baseline', 'blocks'));
  const lost = wanted.filter((stem) => !found.has(stem)).sort();
  const extra = [...found].filter((stem) => !wanted.includes(stem)).sort();
  const waiting = wanted.filter((stem) => pending.has(`blocks/${stem}`)).sort();
  return { checked: wanted.length - waiting.length, pending: waiting, lost, extra };
}

/** Vergleicht baseline, Tests und `pending.json` unter `root/e2e/boards`. */
export function checkBoards(root) {
  const dir = join(root, 'e2e', 'boards');
  const baseline = baselineStems(join(dir, 'baseline'));
  const tested = testedStems(dir);
  const pending = pendingStems(dir);

  const checked = [...baseline].filter((stem) => tested.has(stem) && !pending.has(stem)).sort();
  const waiting = [...baseline].filter((stem) => pending.has(stem)).sort();
  const missing = [...baseline].filter((stem) => !tested.has(stem) && !pending.has(stem)).sort();

  return { checked, pending: waiting, missing, cards: checkCards(dir, pending) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const { checked, pending, missing, cards } = checkBoards(ROOT);

  for (const stem of missing) {
    console.log(`${stem}: kein Test und kein Eintrag in pending.json`);
  }
  for (const stem of cards.lost) console.log(`blocks/${stem}: der Ausschnitt fehlt`);
  for (const stem of cards.extra) console.log(`blocks/${stem}: keine Karte im Manifest`);
  console.log(`Boards: geprüft ${checked.length}, ausstehend ${pending.length}.`);
  console.log(`Bausteine: geprüft ${cards.checked}, ausstehend ${cards.pending.length}.`);

  const broken = missing.length + cards.lost.length + cards.extra.length;
  if (broken > 0) {
    console.error(`Boards ohne Test und ohne Pending-Eintrag: ${broken}.`);
    process.exit(1);
  }
}
