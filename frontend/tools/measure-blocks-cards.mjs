#!/usr/bin/env node
/** Misst die Karten von `Blocks.dc.html` und schneidet sie aus `Blocks.png`. */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { crop, decode, encode } from './png.mjs';
import { artboards, FLAGS, fontSheet } from './render-boards.mjs';

const BOARD = 'Blocks';

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

/** Macht aus einem Selektor einen Dateinamen. */
export function cardStem(selector) {
  return selector
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Schreibt eine Datei nur, wenn der Inhalt sich ändert. */
function writeIfNew(path, body) {
  if (existsSync(path) && readFileSync(path).equals(body)) return false;
  writeFileSync(path, body);
  return true;
}

// Der Ausschnitt deckt jede angebrochene Zeile ab, wie Playwright ein
// Element aufnimmt. Sonst fehlt der Karte eine Zeile.
function frame(box) {
  const x = Math.floor(box.x);
  const y = Math.floor(box.y);
  return { x, y, w: Math.ceil(box.x + box.w) - x, h: Math.ceil(box.y + box.h) - y };
}

/** Liest die Kartengeometrie aus dem Board, gerendert wie die Baseline. */
async function boxes(root, board) {
  const sheet = fontSheet(join(root, 'node_modules/@stupa-makers/ui-kit/assets/fonts'));
  const browser = await chromium.launch({
    executablePath: process.env['BROWSER_PATH'],
    args: FLAGS,
  });
  const context = await browser.newContext({ deviceScaleFactor: 1, colorScheme: 'dark' });
  await context.route('https://fonts.googleapis.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/css', body: sheet });
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: board.width, height: board.height });
  await page.goto(pathToFileURL(board.file).href);
  await page.evaluate(() => document.fonts.ready);
  const found = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-block]')).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        selector: el.getAttribute('data-block'),
        x: r.x,
        y: r.y + window.scrollY,
        w: r.width,
        h: r.height,
      };
    }),
  );
  await browser.close();
  return found;
}

/** Misst die Karten und legt Manifest und Ausschnitte unter `e2e/boards`. */
export async function measure(root) {
  const source = findSource(root, 'artefakte/mockups/code');
  const images = findSource(root, 'artefakte/mockups/bilder');
  if (!source || !images) return null;

  const board = artboards(source).find((entry) => entry.stem === BOARD);
  if (!board) throw new Error(`${BOARD} steht nicht in canvas.json`);

  const cards = (await boxes(root, board)).map((box, order) => ({
    selector: box.selector,
    stem: cardStem(box.selector),
    order,
    ...frame(box),
  }));
  const stems = new Set();
  for (const card of cards) {
    if (stems.has(card.stem)) throw new Error(`Zwei Karten heissen ${card.stem}`);
    stems.add(card.stem);
  }

  const target = join(root, 'e2e/boards');
  const folder = join(target, 'baseline', BOARD.toLowerCase());
  mkdirSync(folder, { recursive: true });
  writeIfNew(join(target, 'blocks-cards.json'), Buffer.from(JSON.stringify(cards, null, 2) + '\n'));

  const image = decode(readFileSync(join(images, `${BOARD}.png`)));
  // Ein Bild ohne die letzte Zeile gibt einen falschen Ausschnitt. Solche
  // Karten bleiben ohne Bild und stehen im Ergebnis.
  const clipped = cards.filter((card) => card.y + card.h > image.height).map((card) => card.stem);
  let fresh = 0;
  for (const card of cards) {
    if (clipped.includes(card.stem)) continue;
    if (writeIfNew(join(folder, `${card.stem}.png`), encode(crop(image, card)))) fresh += 1;
  }
  let stale = 0;
  for (const name of readdirSync(folder)) {
    if (!name.endsWith('.png') || stems.has(name.slice(0, -4))) continue;
    rmSync(join(folder, name));
    stale += 1;
  }
  return {
    count: cards.length,
    fresh,
    same: cards.length - fresh - clipped.length,
    stale,
    clipped,
    height: image.height,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
  const result = await measure(ROOT);
  if (!result) {
    console.error('artefakte/mockups fehlt');
    process.exit(1);
  }
  console.log(
    `${result.count} Karten: ${result.fresh} neu, ${result.same} unverändert, ${result.stale} entfernt`,
  );
  if (result.clipped.length > 0) {
    console.error(
      `${BOARD}.png hat ${result.height} Zeilen und schneidet ${result.clipped.join(', ')} ab. ` +
        'Die Höhe in canvas.json ist kleiner als der Inhalt des Boards.',
    );
  }
}
