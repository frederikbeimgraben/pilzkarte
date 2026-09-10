/**
 * Der Färbe-Worker als eigene Datei, damit ihn Tests durch eine Attrappe
 * ersetzen können, ohne dass ein Testlauf einen echten Worker startet.
 */
export function createWorker(): Worker {
  return new Worker(new URL('./value.worker', import.meta.url), { type: 'module' });
}
