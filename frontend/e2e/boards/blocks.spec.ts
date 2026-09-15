import { expect, test } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { placeholder, type PlaceholderSpec } from '../fixtures/placeholder';
import { boardCards, expectCard, skipPending } from './board';

const CARDS = boardCards();

/** Die Farben des Platzhalters, wie das Board sie an die Stelle eines Fotos setzt. */
const STOPS = ['#3d4a36', '#6b6136', '#2f3a2c'];
const THUMB = { width: 44, height: 44, angle: 140, stops: STOPS, bubbles: true } as const;

/** Je Bild die Fläche, die das Board an seiner Stelle malt. */
const PHOTOS: Readonly<Record<string, PlaceholderSpec>> = {
  'bild-eins': { width: 380, height: 120, angle: 140, stops: STOPS, bubbles: true },
  'bild-zwei': { width: 380, height: 300, angle: 140, stops: STOPS, bubbles: true },
  'bild-drei': { width: 380, height: 100, angle: 140, stops: STOPS, bubbles: true },
  'bild-vier': { width: 376, height: 120, angle: 135, stops: ['#8a6b3e', '#c9a36a'] },
  'art-stein': THUMB,
  'art-stein-hell': THUMB,
  'art-marone': THUMB,
  'art-pfifferling': THUMB,
};

test('Blocks', async ({ page }) => {
  // Das Board ist 900 × 9144 gross und läuft nur in seinem eigenen Projekt.
  test.skip(test.info().project.name !== 'blocks', 'Blocks hat ein eigenes Fenster');
  skipPending('Blocks');
  await mockApi(page);
  await page.route('**/api/photos/**', async (route) => {
    const parts = new URL(route.request().url()).pathname.split('/');
    const spec = PHOTOS[parts.at(-2) ?? ''] ?? PHOTOS['bild-eins'];
    await route.fulfill({ status: 200, contentType: 'image/png', body: placeholder(spec) });
  });
  await page.goto('/bausteine');
  await page.waitForLoadState('networkidle');

  const order = await page
    .locator('[data-block]')
    .evaluateAll((blocks) => blocks.map((block) => block.getAttribute('data-block')));
  expect(order).toEqual(CARDS.map((card) => card.selector));

  for (const card of CARDS) await expectCard(page, card);
});
