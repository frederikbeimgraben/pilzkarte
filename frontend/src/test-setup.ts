import { TestBed } from '@angular/core/testing';
import '@testing-library/jest-dom/vitest';

// jsdom kennt `matchMedia` nicht. Ohne Ersatz bräche jeder Dienst, der das
// Betriebssystem nach dem Theme fragt.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (medium: string) => ({
    matches: false,
    media: medium,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom hat keine Darstellung und keinen Zeiger. Ohne diese Stummel bräche
// jeder Baustein, der etwas in den Blick holt oder eine Geste fängt.
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.scrollTo = () => undefined;

// jsdom rechnet kein Layout und kennt darum keinen ResizeObserver. Ohne
// Ersatz bräche jede Oberfläche, die ihre eigene Höhe misst.
Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe(): void {
      // Ohne Layout ändert sich keine Größe; es gibt nichts zu melden.
    }
    disconnect(): void {
      // Es gibt nichts zu lösen.
    }
  },
});
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.releasePointerCapture = () => undefined;

// Die Tests prüfen die deutschen Texte. Ohne diese Vorgabe entschiede die
// Sprache des Testbrowsers, welcher Katalog gilt. Beide Quellen der Sprache
// werden gesetzt, damit auch ein gesperrter Speicher nichts verschiebt.
Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'de-DE' });

beforeEach(() => {
  localStorage.setItem('pilzkarte.sprache', 'de');
  // Ohne diesen Schnitt behielte ein Dienst aus dem vorigen Test seinen Zustand.
  TestBed.resetTestingModule();
});

// Die Testdateien teilen sich eine Umgebung (der Builder isoliert sie nicht).
// Ohne diesen Schnitt trüge eine Attrappe aus einer Datei in die nächste.
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
