#!/usr/bin/env node
/** Spiegelt Board-Bilder und Kartenbilder der Artefakte nach `e2e/boards`. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `measure-blocks-cards.mjs` zerlegt das Baustein-Board in Karten.
const EXCLUDED = new Set(['SpecLevels.png', 'Blocks.png']);

/** Sucht einen Ordner der Artefakte von `root` aufwärts. */
function findSource(root, part) {
  let folder = root;
  for (;;) {
    const hit = join(folder, part);
    if (existsSync(hit)) return hit;
    const up = dirname(folder);
    if (up === folder) return null;
    folder = up;
  }
}

/** Kopiert jede PNG aus `from` nach `target`, ohne die gleichen noch einmal. */
function copyImages(from, target, excluded = new Set(), sweep = false) {
  mkdirSync(target, { recursive: true });
  const files = [];
  // Was die Quelle nicht mehr hat, bleibt sonst als totes Bild liegen.
  if (sweep) {
    const source = new Set(readdirSync(from));
    for (const name of readdirSync(target)) {
      if (name.endsWith('.png') && !source.has(name)) rmSync(join(target, name));
    }
  }
  let fresh = 0;
  let same = 0;
  for (const name of readdirSync(from)) {
    if (!name.endsWith('.png')) continue;
    if (excluded.has(name)) {
      files.push({ name, action: 'skip-excluded' });
      continue;
    }
    const to = join(target, name);
    if (existsSync(to) && readFileSync(to).equals(readFileSync(join(from, name)))) {
      same += 1;
      files.push({ name, action: 'skip-same' });
      continue;
    }
    copyFileSync(join(from, name), to);
    fresh += 1;
    files.push({ name, action: 'copy' });
  }
  return { fresh, same, files };
}

/** Spiegelt Board- und Kartenbilder. Gibt `null` ohne Quelle zurück. */
export function sync(root) {
  const from = findSource(root, 'artefakte/mockups/bilder');
  if (!from) return null;

  const target = join(root, 'e2e/boards/baseline');
  const boards = copyImages(from, target, EXCLUDED);

  // Die Kartenbilder stehen neben den Quellen der Boards, nicht bei den
  // Bildern: sie sind Zutat des Tests, kein Board.
  const fixtureSource = findSource(root, 'artefakte/mockups/code/fixtures');
  const fixtures = fixtureSource
    ? copyImages(fixtureSource, join(root, 'e2e/boards/fixtures'), new Set(), true)
    : { fresh: 0, same: 0, files: [] };
  return { from, target, fixtureSource, ...boards, fixtures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
  const result = sync(ROOT);
  if (!result) {
    console.log('artefakte/mockups/bilder fehlt, die eingecheckten Bilder bleiben');
    process.exit(0);
  }
  console.log(`Boards: ${result.fresh} neu, ${result.same} unverändert, Quelle ${result.from}`);
  const seen = result.fixtures.fresh + result.fixtures.same;
  console.log(
    result.fixtureSource
      ? `Kartenbilder: ${result.fixtures.fresh} neu, ${result.fixtures.same} unverändert, ${seen} gesamt`
      : 'artefakte/mockups/code/fixtures fehlt, die eingecheckten Kartenbilder bleiben',
  );
}
