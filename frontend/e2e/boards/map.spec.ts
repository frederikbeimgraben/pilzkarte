import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { ROW_PHOTO } from '../fixtures/photos';
import { authConfig, mockSignIn, mockSignInPending } from '../fixtures/auth';
import {
  BOARD_FACTORS,
  COMBINATIONS,
  FICHTE_LAYERS_MANIFEST,
  MARKERS,
  SHARED_FINDS,
  SPECIES_BUNDLE,
  ZONES,
  mockMap,
  showMapImage,
  type BoardState,
} from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Die Drehung der Boards `MapRotated` und `MapDesktopRotated`. */
const BOARD_BEARING = 30;

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Die Antworten des Vertrags, die die Karte braucht. */
const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': COMBINATIONS,
  '/api/markers': MARKERS,
  '/api/zones': ZONES,
  '/api/finds': SHARED_FINDS,
};

async function openMap(
  page: Page,
  state: BoardState = {},
  factors = '',
  layersManifest?: unknown,
): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page, state, factors, layersManifest);
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
}

/** Legt das Kartenbild auf und vergleicht dann mit dem Board. */
async function board(page: Page, stem: string, image = 'map-stein-470.png'): Promise<void> {
  if (image !== '') await showMapImage(page, image);
  await expectBoard(page, stem);
}

/** Dieselbe Karte, aber mit Konto: Speichern fragt dann nicht erst nach. */
async function openSignedIn(page: Page, factors = ''): Promise<void> {
  await openMap(page, { view: 'combination', detent: 2 }, factors);
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
}

/** Ein Board zeigt weder Fokusring noch Mauszustand. */
async function blur(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const active: Element | null = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

/** Speichern führt ohne Konto zuerst durch die Anmeldung. */
async function askForName(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Speichern' }).first().click();
  const signIn = page.getByRole('button', { name: /beimgraben\.net/ });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
    await page.getByRole('button', { name: 'Speichern' }).first().click();
  }
}

test('Map', async ({ page }) => {
  guard('Map', 'phone');
  await openMap(page);
  await board(page, 'Map');
});

/** Dreht die Karte über den Testhaken, wie eine Geste es täte. */
async function turnMap(page: Page, bearing: number): Promise<void> {
  await page.waitForFunction(() => 'pilzMap' in window);
  await page.evaluate((angle) => {
    (window as unknown as { pilzMap: { rotate: (b: number, p: number) => void } }).pilzMap.rotate(angle, 0);
  }, bearing);
}

test('MapRotated', async ({ page }) => {
  guard('MapRotated', 'phone');
  await openMap(page, { detent: 0 });
  await turnMap(page, -BOARD_BEARING);
  await expect(page.getByRole('button', { name: 'Nach Norden drehen' })).toBeVisible();
  await showMapImage(page, 'map-stein-631-gedreht.png');
  await expectBoard(page, 'MapRotated');
});

test('MapDesktopRotated', async ({ page }) => {
  guard('MapDesktopRotated', 'wide');
  await openMap(page);
  await turnMap(page, -BOARD_BEARING);
  await expect(page.getByRole('button', { name: 'Nach Norden drehen' })).toBeVisible();
  await showMapImage(page, 'map-desktop-stein-900-gedreht.png');
  await expectBoard(page, 'MapDesktopRotated');
});

test('MapCollapsed', async ({ page }) => {
  guard('MapCollapsed', 'phone');
  await openMap(page, { detent: 0 });
  await board(page, 'MapCollapsed', 'map-stein-631.png');
});

test('MapLayersButton', async ({ page }) => {
  guard('MapLayersButton', 'phone');
  await openMap(page, { detent: 0 });
  await page.getByRole('button', { name: 'Ebenen' }).click();
  await board(page, 'MapLayersButton', 'map-stein-631.png');
});

test('LayerTab', async ({ page }) => {
  guard('LayerTab', 'phone');
  await openMap(page, { view: 'layer' });
  await board(page, 'LayerTab', 'map-regen-470.png');
});

test('LayerTabCredit', async ({ page }) => {
  guard('LayerTabCredit', 'phone');
  await openMap(page, { view: 'layer', layer: 'fichte' }, '', FICHTE_LAYERS_MANIFEST);
  await board(page, 'LayerTabCredit');
});

test('CombinationTab', async ({ page }) => {
  guard('CombinationTab', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS);
  await board(page, 'CombinationTab', 'map-schnitt-300.png');
});

test('Factor', async ({ page }) => {
  guard('Factor', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS);
  await page.getByRole('button', { name: '≥ 80 mm' }).click();
  await board(page, 'Factor', 'map-regen-300.png');
});

test('SpeciesChooser', async ({ page }) => {
  guard('SpeciesChooser', 'phone');
  await openMap(page);
  await page.getByRole('button', { name: 'Steinpilz' }).click();
  await board(page, 'SpeciesChooser', 'map-stein-300.png');
});

test('FactorPicker', async ({ page }) => {
  guard('FactorPicker', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS);
  await page.getByRole('button', { name: 'Faktor hinzufügen' }).click();
  await board(page, 'FactorPicker', 'map-regen-300.png');
});

test('CombinationSave', async ({ page }) => {
  guard('CombinationSave', 'phone');
  await openSignedIn(page, BOARD_FACTORS);
  await askForName(page);
  await expect(page.getByText('Kombination speichern')).toBeVisible();
  await page.getByRole('textbox').fill('Herbst Steinpilz');
  await blur(page);
  await board(page, 'CombinationSave', 'map-schnitt-470.png');
});

test('Combinations', async ({ page }) => {
  guard('Combinations', 'phone');
  await openSignedIn(page, BOARD_FACTORS);
  await page.getByRole('button', { name: /Gespeicherte Kombinationen/ }).click();
  await board(page, 'Combinations', 'map-schnitt-300.png');
});

test('MapUpdate', async ({ page }) => {
  guard('MapUpdate', 'phone');
  await openMap(page);
  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } },
      }),
    );
  });
  await expect(page.getByRole('status')).toContainText('Neue Version');
  await board(page, 'MapUpdate');
});

test('MapOffline', async ({ page }) => {
  guard('MapOffline', 'phone');
  await openMap(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByRole('status')).toContainText('Keine Verbindung');
  await board(page, 'MapOffline');
});

test('MapSkeleton', async ({ page }) => {
  guard('MapSkeleton', 'phone');
  // Ohne Antwort des SSO bleibt die Sitzung offen und der Avatar ein Skelett.
  await mockSignInPending(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page);
  // Ohne Manifest zeigt die Karte ihr Raster; ein Kartenbild gehört nicht dazu.
  await page.route(/\/[a-z0-9_-]+\.json$/, async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await page.goto('/karte');
  await expectBoard(page, 'MapSkeleton', { idle: false });
});

test('MapDesktop', async ({ page }) => {
  guard('MapDesktop', 'wide');
  await openMap(page);
  await board(page, 'MapDesktop', 'map-desktop-stein-900.png');
});

test('MapDesktopSpeciesModal', async ({ page }) => {
  guard('MapDesktopSpeciesModal', 'wide');
  await openMap(page);
  await page.getByRole('button', { name: 'Steinpilz' }).click();
  await board(page, 'MapDesktopSpeciesModal', 'map-desktop-stein-900.png');
});

test('MapDesktopLayers', async ({ page }) => {
  guard('MapDesktopLayers', 'wide');
  await openMap(page);
  await page.getByRole('button', { name: 'Ebenen' }).click();
  await board(page, 'MapDesktopLayers', 'map-desktop-stein-900.png');
});

test('MapDesktopLayersCredit', async ({ page }) => {
  guard('MapDesktopLayersCredit', 'wide');
  await openMap(page, { layer: 'fichte' }, '', FICHTE_LAYERS_MANIFEST);
  await page.getByRole('button', { name: 'Ebenen' }).click();
  await board(page, 'MapDesktopLayersCredit', 'map-desktop-stein-900.png');
});

test('MapDesktopFactorPicker', async ({ page }) => {
  guard('MapDesktopFactorPicker', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await page.getByRole('button', { name: 'Faktor hinzufügen' }).click();
  await board(page, 'MapDesktopFactorPicker', 'map-desktop-stein-900.png');
});

test('MapDesktopCombinations', async ({ page }) => {
  guard('MapDesktopCombinations', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await page.getByRole('button', { name: /Gespeicherte Kombinationen/ }).click();
  await board(page, 'MapDesktopCombinations', 'map-desktop-stein-900.png');
});

test('MapDesktopCombinationSave', async ({ page }) => {
  guard('MapDesktopCombinationSave', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await askForName(page);
  await expect(page.getByRole('heading', { name: 'Kombination speichern' })).toBeVisible();
  await page.getByRole('textbox').fill('Herbst Steinpilz');
  await blur(page);
  await board(page, 'MapDesktopCombinationSave', 'map-desktop-stein-900.png');
});

test('MapDesktopFactor', async ({ page }) => {
  guard('MapDesktopFactor', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await page.getByRole('button', { name: '≥ 80 mm' }).click();
  await board(page, 'MapDesktopFactor', 'map-desktop-stein-900.png');
});

test('MapDesktopTimelineEnd', async ({ page }) => {
  guard('MapDesktopTimelineEnd', 'wide');
  await openMap(page);
  await page.getByRole('button', { name: 'KW 43 · 2025 · Prognose' }).click();
  await page.waitForTimeout(400);
  await blur(page);
  await board(page, 'MapDesktopTimelineEnd', 'map-desktop-stein-900.png');
});
