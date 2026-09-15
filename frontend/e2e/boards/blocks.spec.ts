import { expect, test } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { boardCards, expectCard, skipPending } from './board';

const CARDS = boardCards();

test('Blocks', async ({ page }) => {
  skipPending('Blocks');
  await mockApi(page);
  await page.goto('/bausteine');
  await page.waitForLoadState('networkidle');

  const order = await page
    .locator('[data-block]')
    .evaluateAll((blocks) => blocks.map((block) => block.getAttribute('data-block')));
  expect(order).toEqual(CARDS.map((card) => card.selector));

  for (const card of CARDS) await expectCard(page, card);
});
