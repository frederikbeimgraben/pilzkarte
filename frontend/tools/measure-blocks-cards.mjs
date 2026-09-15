#!/usr/bin/env node
/** Misst die Karten von `Blocks.dc.html` und schneidet sie aus `Blocks.png`. */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { crop, decode, encode } from './png.mjs';

const BOARD = 'Blocks';
const VIEW = { width: 900, height: 9144 };

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

// Der Ausschnitt beginnt auf der angebrochenen Zeile, wie der Browser sie
// zeichnet. Aufrunden verschöbe die Schrift um eine Zeile.
function frame(box) {
  return { x: Math.floor(box.x), y: Math.floor(box.y), w: Math.round(box.w), h: Math.round(box.h) };
}

/** Liest die Kartengeometrie aus dem Board. */
async function boxes(htmlPath) {
  const browser = await chromium.launch({ executablePath: process.env['BROWSER_PATH'] || undefined });
  const page = await browser.newPage({ viewport: VIEW, colorScheme: 'dark', locale: 'de-DE' });
  await page.goto(pathToFileURL(htmlPath).href);
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

  const cards = (await boxes(join(source, `${BOARD}.dc.html`))).map((box, order) => ({
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

  const board = decode(readFileSync(join(images, `${BOARD}.png`)));
  let fresh = 0;
  for (const card of cards) {
    if (writeIfNew(join(folder, `${card.stem}.png`), encode(crop(board, card)))) fresh += 1;
  }
  let stale = 0;
  for (const name of readdirSync(folder)) {
    if (!name.endsWith('.png') || stems.has(name.slice(0, -4))) continue;
    rmSync(join(folder, name));
    stale += 1;
  }
  return { count: cards.length, fresh, same: cards.length - fresh, stale };
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
}
