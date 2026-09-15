#!/usr/bin/env node
/** Misst die Kartengeometrie von `Blocks.dc.html` und schreibt sie in `blocks-cards.json`. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

/** Sucht `artefakte/mockups/code` von `root` aufwärts. */
function findSource(root) {
  let folder = root;
  for (;;) {
    const hit = join(folder, 'artefakte/mockups/code');
    if (existsSync(hit)) return hit;
    const up = dirname(folder);
    if (up === folder) return null;
    folder = up;
  }
}

export async function measure(root) {
  const dir = findSource(root);
  if (!dir) return null;

  const htmlPath = join(dir, 'Blocks.dc.html');
  const jsonPath = join(dir, 'blocks-cards.json');
  const manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));

  const browser = await chromium.launch({
    executablePath: process.env['BROWSER_PATH'] || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1024 } });
  await page.goto(pathToFileURL(htmlPath).href);
  const boxes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-block]')).map((el) => {
      const r = el.getBoundingClientRect();
      return { selector: el.getAttribute('data-block'), x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  await browser.close();

  if (boxes.length !== manifest.length) {
    throw new Error(`${boxes.length} Karten im DOM, ${manifest.length} im Manifest`);
  }

  const merged = manifest.map((entry, i) => {
    const box = boxes[i];
    if (box.selector !== entry.selector) {
      throw new Error(`Reihenfolge weicht ab: Manifest ${entry.selector}, DOM ${box.selector}`);
    }
    return {
      ...entry,
      x: Math.round(box.x),
      y: Math.round(box.y),
      w: Math.round(box.w),
      h: Math.round(box.h),
    };
  });

  writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + '\n');
  return { jsonPath, count: merged.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
  const result = await measure(ROOT);
  if (!result) {
    console.error('artefakte/mockups/code fehlt');
    process.exit(1);
  }
  console.log(`${result.count} Karten vermessen, ${result.jsonPath}`);
}
