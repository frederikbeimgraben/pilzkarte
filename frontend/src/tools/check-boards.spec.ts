import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBoards } from '../../tools/check-boards.mjs';

/** Legt `e2e/boards` mit Baseline-Bildern unter einem frischen Wurzelordner an. */
function fixture(stems: string[], cards: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), 'check-boards-'));
  mkdirSync(join(root, 'e2e', 'boards', 'baseline', 'blocks'), { recursive: true });
  for (const stem of stems) {
    writeFileSync(join(root, 'e2e', 'boards', 'baseline', `${stem}.png`), '');
  }
  for (const stem of cards) {
    writeFileSync(join(root, 'e2e', 'boards', 'baseline', 'blocks', `${stem}.png`), '');
  }
  writeFileSync(
    join(root, 'e2e', 'boards', 'blocks-cards.json'),
    JSON.stringify(cards.map((stem) => ({ selector: stem, stem }))),
  );
  return root;
}

/** Das Ergebnis der Bausteine, wenn keine Karte im Manifest steht. */
const NO_CARDS = { checked: 0, pending: [], lost: [], extra: [] };

/** Legt eine Spec-Datei mit `expectBoard`-Aufrufen unter `e2e/boards` an. */
function spec(root: string, name: string, boards: string[]): void {
  const calls = boards.map((board) => `expectBoard(page, '${board}');`).join('\n');
  writeFileSync(join(root, 'e2e', 'boards', name), calls, 'utf8');
}

/** Schreibt `pending.json` unter `e2e/boards`. */
function pending(root: string, stems: string[]): void {
  writeFileSync(join(root, 'e2e', 'boards', 'pending.json'), JSON.stringify(stems));
}

describe('check-boards', () => {
  it('zählt einen getesteten Stem als geprüft', () => {
    const root = fixture(['Species']);
    try {
      spec(root, 'species.spec.ts', ['Species']);
      pending(root, []);

      expect(checkBoards(root)).toEqual({
        checked: ['Species'],
        pending: [],
        missing: [],
        cards: NO_CARDS,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('zählt einen Stem aus pending.json als ausstehend, auch ohne Test', () => {
    const root = fixture(['Map']);
    try {
      spec(root, 'species.spec.ts', []);
      pending(root, ['Map']);

      expect(checkBoards(root)).toEqual({
        checked: [],
        pending: ['Map'],
        missing: [],
        cards: NO_CARDS,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lässt einen Stem mit Test trotz Pending-Eintrag ausstehend', () => {
    const root = fixture(['Map']);
    try {
      spec(root, 'map.spec.ts', ['Map']);
      pending(root, ['Map']);

      expect(checkBoards(root)).toEqual({
        checked: [],
        pending: ['Map'],
        missing: [],
        cards: NO_CARDS,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('meldet einen Stem ohne Test und ohne Pending-Eintrag als fehlend', () => {
    const root = fixture(['Texts']);
    try {
      spec(root, 'species.spec.ts', []);
      pending(root, []);

      expect(checkBoards(root)).toEqual({
        checked: [],
        pending: [],
        missing: ['Texts'],
        cards: NO_CARDS,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('zählt einen Ausschnitt des Baustein-Boards als geprüft', () => {
    const root = fixture([], ['app-button']);
    try {
      spec(root, 'blocks.spec.ts', []);
      pending(root, []);

      expect(checkBoards(root).cards).toEqual({
        checked: 1,
        pending: [],
        lost: [],
        extra: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('meldet einen Ausschnitt ohne Karte im Manifest', () => {
    const root = fixture([], ['app-button']);
    try {
      spec(root, 'blocks.spec.ts', []);
      pending(root, []);
      writeFileSync(join(root, 'e2e', 'boards', 'baseline', 'blocks', 'app-alt.png'), '');

      expect(checkBoards(root).cards.extra).toEqual(['app-alt']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
