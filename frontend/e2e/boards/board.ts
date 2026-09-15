import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Liest Breite und Höhe aus dem IHDR-Kopf einer PNG-Datei. */
function size(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

/** Liest die Stems aus `pending.json`. */
function pendingStems(): Set<string> {
  const path = join(test.info().config.rootDir, 'boards/pending.json');
  return new Set(JSON.parse(readFileSync(path, 'utf8')) as string[]);
}

/** Ein Board aus `pending.json` läuft gar nicht, auch nicht seine Schritte. */
export function skipPending(board: string): void {
  test.skip(pendingStems().has(board), `${board} steht in pending.json`);
}

/** Eine Karte des Baustein-Boards mit Lage, Groesse und Dateinamen. */
export interface BoardCard {
  readonly selector: string;
  readonly stem: string;
  readonly w: number;
  readonly h: number;
}

/** Liest das Manifest der Baustein-Karten. */
export function boardCards(): BoardCard[] {
  return JSON.parse(readFileSync(join(__dirname, 'blocks-cards.json'), 'utf8')) as BoardCard[];
}

/**
 * Prüft Groesse und Bild einer Karte gegen `baseline/blocks/<stem>.png`,
 * Toleranz 0,5 % Pixel. Eine Karte aus `pending.json` bleibt aus.
 */
export async function expectCard(page: Page, card: BoardCard): Promise<void> {
  if (pendingStems().has(`blocks/${card.stem}`)) return;
  const block = page.locator(`[data-block="${card.selector}"]`);
  const box = await block.boundingBox();
  const size = { w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0) };
  expect.soft(size, card.selector).toEqual({ w: card.w, h: card.h });
  await expect.soft(block, card.selector).toHaveScreenshot(['blocks', `${card.stem}.png`]);
}

/** Ein Board, dessen Seite noch lädt, wartet nicht auf Ruhe im Netz. */
export interface BoardOptions {
  idle?: boolean;
}

/**
 * Vergleicht die Ansicht mit `baseline/<board>.png`, Toleranz 0,5 % Pixel.
 * Ein Board aus `pending.json` läuft nicht. Das Board läuft sonst nur in
 * dem Projekt, dessen Fenster zum Bild passt.
 */
export async function expectBoard(page: Page, board: string, options: BoardOptions = {}): Promise<void> {
  test.skip(pendingStems().has(board), `${board} steht in pending.json`);
  const image = size(join(test.info().config.rootDir, 'boards/baseline', `${board}.png`));
  const viewport = page.viewportSize();
  const fits = viewport?.width === image.width && viewport.height === image.height;
  test.skip(!fits, `${board} gehört zu ${image.width}×${image.height}`);
  if (options.idle ?? true) await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot(`${board}.png`);
}
