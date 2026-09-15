import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reflectComponentType, type Type } from '@angular/core';
import * as ui from './index';

/** Die Liste aus `artefakte/komponenten.md`, Abschnitt Gerüst und weitere,
 * dazu die Meldung, die das Board flach über die Breite zeichnet. */
const BLOCKS = [
  'app-page-header',
  'app-nav',
  'app-sheet',
  'app-sheet-head',
  'app-overlay-host',
  'app-filter-sheet',
  'app-object-menu',
  'app-action-bar',
  'app-icon-button',
  'app-split-layout',
  'app-popover',
  'app-confirm-dialog',
  'app-reject-dialog',
  'app-review-queue',
  'app-banner',
  'app-list-row',
  'app-species-row',
  'app-entry-row',
  'app-add-row',
  'app-check-row',
  'app-factor-row',
  'app-key-value-table',
  'app-key-value-row',
  'app-choice-row',
  'app-form-field',
  'app-search-field',
  'app-segmented',
  'app-switch',
  'app-chip-group',
  'app-filter-chip',
  'app-range-slider',
  'app-colour-swatches',
  'app-colour-picker',
  'app-species-picker',
  'app-photo-picker',
  'app-year-band-input',
  'app-level-pill',
  'app-tag-list',
  'app-colour-field',
  'app-colour-change',
  'app-measurement',
  'app-measurement-group',
  'app-year-band',
  'app-season-curve',
  'app-histogram',
  'app-ramp',
  'app-timeline',
  'app-week-button',
  'app-image-tile',
  'app-image-credit',
  'app-image-viewer',
  'app-private-image',
  'app-avatar-button',
  'app-back-head',
  'app-floating-button',
  'app-crosshair',
  'app-svg-icon',
  'app-stat-row',
  'app-empty-state',
  'app-error-state',
  'app-infinite-list',
  'app-skeleton',
  'app-progress',
  'app-toast',
] as const;

const UI_ROOT = join(process.cwd(), 'src', 'app', 'ui');

function exportedSelectors(): string[] {
  const found: string[] = [];
  for (const value of Object.values(ui)) {
    if (typeof value !== 'function') continue;
    const meta = reflectComponentType(value as Type<unknown>);
    if (meta) found.push(meta.selector);
  }
  return found;
}

function selectorsOnDisk(): string[] {
  const found: string[] = [];
  const walk = (folder: string): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.component.ts')) continue;
      const match = /selector:\s*'(app-[a-z0-9-]+)'/.exec(readFileSync(path, 'utf8'));
      if (match) found.push(match[1]);
    }
  };
  walk(UI_ROOT);
  return found;
}

describe('ui/index', () => {
  it('führt jeden Baustein der Liste', () => {
    expect([...exportedSelectors()].sort()).toEqual([...BLOCKS].sort());
  });

  it('führt keinen Baustein über die Liste hinaus', () => {
    expect([...new Set(selectorsOnDisk())].sort()).toEqual([...BLOCKS].sort());
  });

  it('gibt jeden Selector genau einmal aus', () => {
    const selectors = exportedSelectors();
    expect(new Set(selectors).size).toBe(selectors.length);
  });
});
