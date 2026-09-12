import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { CATALOG, SUPPORTED_LOCALES } from './translations';

/**
 * Ein frischer Dienst je Test. Die Sprache wird beim Bauen gelesen; ohne
 * Schnitt trüge die Wahl aus dem vorigen Test in den nächsten.
 */
function service(): I18nService {
  TestBed.resetTestingModule();
  return TestBed.inject(I18nService);
}

describe('I18nService', () => {
  it('führt Deutsch als Leitsprache', () => {
    expect(service().translate('nav.karte')).toBe('Karte');
    expect(document.documentElement.lang).toBe('de');
  });

  it('wechselt die Sprache und merkt sie sich', () => {
    const i18n = service();

    i18n.setLocale('en');

    expect(i18n.locale()).toBe('en');
    expect(i18n.translate('nav.karte')).toBe('Map');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('pilzkarte.sprache')).toBe('en');
  });

  it('lehnt eine unbekannte Sprache ab', () => {
    const i18n = service();

    i18n.setLocale('fr' as 'de');

    expect(i18n.locale()).toBe('de');
  });

  it('füllt Platzhalter und lässt unbekannte stehen', () => {
    const i18n = service();

    expect(i18n.translate('zeitleiste.woche', { woche: 40, jahr: 2025 })).toBe('KW 40 · 2025');
    expect(i18n.translate('zeitleiste.woche', { woche: 40 })).toBe('KW 40 · {jahr}');
  });

  it('nimmt die saved Sprache beim Start', () => {
    localStorage.setItem('pilzkarte.sprache', 'en');

    expect(service().locale()).toBe('en');
  });

  it('folgt unter „System“ dem Browser und merkt sich die Wahl', () => {
    const i18n = service();

    i18n.setChoice('system');

    // Der Testbrowser steht auf de-DE, siehe `test-setup.ts`.
    expect(i18n.choice()).toBe('system');
    expect(i18n.locale()).toBe('de');
    expect(localStorage.getItem('pilzkarte.sprache')).toBe('system');
  });

  it('hält die Wahl gegen einen fremdsprachigen Browser', () => {
    localStorage.setItem('pilzkarte.sprache', 'de');
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'en-GB' });

    // Ein englischer Browser machte aus der App sonst eine halb übersetzte
    // Seite: die Oberfläche englisch, der Artenkatalog deutsch.
    expect(service().locale()).toBe('de');
  });

  it('lehnt eine unbekannte Wahl ab', () => {
    const i18n = service();

    i18n.setChoice('fr' as 'de');

    expect(i18n.choice()).toBe('de');
  });

  it('fällt ohne saved Wahl auf die Browsersprache', () => {
    localStorage.clear();
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');

    expect(service().locale()).toBe('en');
  });

  it('fällt bei unbekannter Browsersprache auf Deutsch', () => {
    localStorage.clear();
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');

    expect(service().locale()).toBe('de');
  });

  it('kommt ohne Speicher aus', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });

    const i18n = service();
    i18n.setLocale('en');

    expect(i18n.locale()).toBe('en');
    read.mockRestore();
    write.mockRestore();
  });

  it('kennt jeden Schlüssel in beiden Katalogen', () => {
    const schluessel = Object.keys(CATALOG.de);

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(CATALOG[locale])).toHaveLength(schluessel.length);
      for (const entry of schluessel) {
        expect(CATALOG[locale][entry as keyof typeof CATALOG.de]).not.toBe('');
      }
    }
  });
});
