import { defineConfig } from '@playwright/test';

// Mehrere Zweige messen zur selben Zeit; der Anschluss lässt sich setzen.
const PORT = Number(process.env['E2E_PORT'] ?? 4400);
const ADDRESS = `http://127.0.0.1:${PORT}`;
const CI = Boolean(process.env['CI']);
const BROWSER_PATH = process.env['BROWSER_PATH'];

/** Ein Board ist ein Bild je Gerät. Ein Fluss läuft nur am Telefon. */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 820 };
const WIDE = { width: 1440, height: 900 };
const BLOCKS = { width: 900, height: 9431 };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/ergebnisse',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['list'], ['html', { outputFolder: 'e2e/bericht', open: 'never' }]] : [['list']],
  snapshotPathTemplate: '{testDir}/boards/baseline/{arg}{ext}',
  use: {
    baseURL: ADDRESS,
    browserName: 'chromium',
    // Dieselben Schalter wie `tools/render-boards.mjs`: der Schriftsatz der
    // Boards und der Tests muss gleich sein.
    launchOptions: {
      args: ['--disable-lcd-text', '--font-render-hinting=none'],
      ...(BROWSER_PATH ? { executablePath: BROWSER_PATH } : {}),
    },
    trace: 'retain-on-failure',
    colorScheme: 'dark',
    // Ein Service Worker fängt die Anfragen ab, bevor eine Attrappe greift.
    // Der Installationstest schaltet ihn für sich wieder an.
    serviceWorkers: 'block',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled', caret: 'hide' },
  },
  projects: [
    // Muster als Glob: ein Zweigname mit „boards“ im Weg zöge sonst jede Datei.
    { name: 'phone', testMatch: 'boards/*.spec.ts', use: { viewport: PHONE } },
    { name: 'desktop', testMatch: 'boards/*.spec.ts', use: { viewport: DESKTOP } },
    { name: 'wide', testMatch: 'boards/*.spec.ts', use: { viewport: WIDE } },
    // Das Baustein-Board vergleicht 67 Karten in einem Test.
    {
      name: 'blocks',
      testMatch: 'boards/blocks.spec.ts',
      timeout: 600_000,
      use: { viewport: BLOCKS },
    },
    { name: 'flows', testMatch: 'flows/*.spec.ts', use: { viewport: PHONE } },
  ],
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: ADDRESS,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
