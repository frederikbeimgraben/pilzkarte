#!/usr/bin/env node
/**
 * Sucht festen Text in den Vorlagen unter `src/app`.
 *
 * Kein Text steht fest im Code (`CLAUDE.md`). Jede Zeichenkette, die eine
 * Person liest, ist ein Schlüssel und kommt über `| t` aus dem Katalog; der
 * Katalog steht in der Datenbank und lässt sich in der Verwaltung ändern.
 *
 * Das Skript lässt nur stehen, was eine Person wirklich sieht: Marken,
 * Ausdrücke in `{{ }}`, Bindungen und die Blöcke von Angular fallen weg. Was
 * danach noch Buchstaben trägt, ist ein fester Text.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/app', import.meta.url).pathname;

/** `@if (...) {`, `@else if (...) {`, `@for (...) {` und alles Weitere. */
const BLOCK = /@[a-z]+(?:\s+[a-z]+)?\s*(?:\([^{]*\))?\s*\{/g;
const COMMENT = /<!--[\s\S]*?-->/g;
const TAG = /<[^>]*>/g;
const EXPRESSION = /\{\{[^}]*\}\}/g;
const WORD = /[A-Za-zÄÖÜäöüß]{2,}/;

/** Attribute, die eine Person liest. Gebunden (`[title]="… | t"`) sind sie in Ordnung. */
const VISIBLE_ATTRIBUTES = /\s(?:placeholder|title|alt|aria-label)="([^"]*)"/g;

/** Jeder feste Text einer Vorlage. */
function hardCoded(source) {
  const withoutComments = source.replace(COMMENT, ' ');
  const found = [];
  for (const [, value] of withoutComments.matchAll(VISIBLE_ATTRIBUTES)) {
    if (WORD.test(value)) found.push(value);
  }
  const text = withoutComments
    .replace(TAG, '\n')
    .replace(EXPRESSION, ' ')
    .replace(BLOCK, ' ')
    .replaceAll('{', ' ')
    .replaceAll('}', ' ');
  for (const line of text.split('\n')) {
    if (WORD.test(line)) found.push(line.trim());
  }
  return found;
}

function walk(folder, found) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      walk(path, found);
      continue;
    }
    if (!name.endsWith('.html')) continue;
    for (const text of hardCoded(readFileSync(path, 'utf8'))) {
      found.push(`${path.slice(ROOT.length + 1)}: ${text}`);
    }
  }
  return found;
}

const found = walk(ROOT, []);

if (found.length > 0) {
  console.error(`${found.length} feste Texte in den Vorlagen:`);
  for (const place of found) console.error('  ' + place);
  process.exit(1);
}
console.log('Keine festen Texte in den Vorlagen von src/app.');
