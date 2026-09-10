/**
 * Der Färbe-Worker als eigene Datei, damit ihn Tests durch eine Attrappe
 * ersetzen können, ohne dass ein Testlauf einen echten Worker startet.
 */
export function baueArbeiter(): Worker {
  return new Worker(new URL('./wert.worker', import.meta.url), { type: 'module' });
}
