import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TextCatalogue, TextEntry } from '../api/models';
import { I18nService } from './i18n.service';
import { TextCatalogService, areaOf, textsOf } from './text-catalog.service';

const MAP: TextEntry = {
  key: 'nav.karte',
  values: { de: 'Landkarte', en: 'Chart' },
  changed: true,
  updatedAt: '2026-09-12T08:00:00+00:00',
};

const SPECIES: TextEntry = {
  key: 'nav.arten',
  values: { de: 'Arten', en: 'Species' },
  changed: false,
  updatedAt: '2026-09-12T08:00:00+00:00',
};

const CATALOGUE: TextCatalogue = {
  revision: 'W/"2-1"',
  locales: ['de', 'en'],
  entries: [MAP, SPECIES],
};

interface Setup {
  catalog: TextCatalogService;
  i18n: I18nService;
  http: HttpTestingController;
}

function build(): Setup {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return {
    catalog: TestBed.inject(TextCatalogService),
    i18n: TestBed.inject(I18nService),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('TextCatalogService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('baut aus den Einträgen je Sprache ein Wörterbuch', () => {
    expect(textsOf([MAP])).toEqual({ de: { 'nav.karte': 'Landkarte' }, en: { 'nav.karte': 'Chart' } });
  });

  it('liest den Bereich aus dem Schlüssel', () => {
    expect(areaOf('karte.legende')).toBe('karte');
  });

  it('holt den Katalog und stellt ihn vor den eingebauten', async () => {
    const setup = build();

    const loaded = setup.catalog.load();
    setup.http.expectOne('/api/texts').flush(CATALOGUE);
    await loaded;

    expect(setup.i18n.translate('nav.karte')).toBe('Landkarte');
    expect(setup.catalog.areas()).toEqual(['nav']);
  });

  it('bleibt ohne Server beim eingebauten Katalog', async () => {
    const setup = build();

    const loaded = setup.catalog.load();
    setup.http.expectOne('/api/texts').error(new ProgressEvent('error'), { status: 0 });
    await loaded;

    expect(setup.i18n.translate('nav.karte')).toBe('Karte');
  });

  it('legt den Katalog ab und nimmt ihn beim nächsten Start ohne Netzweg', async () => {
    const first = build();
    const loaded = first.catalog.load();
    first.http.expectOne('/api/texts').flush(CATALOGUE);
    await loaded;

    const again = build();
    again.catalog.restore();

    expect(again.i18n.translate('nav.karte')).toBe('Landkarte');
    again.http.expectNone('/api/texts');
  });

  it('kommt ohne lokalen Speicher aus', async () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const setup = build();

    setup.catalog.restore();
    const loaded = setup.catalog.load();
    setup.http.expectOne('/api/texts').flush(CATALOGUE);
    await loaded;

    expect(setup.i18n.translate('nav.karte')).toBe('Landkarte');
    read.mockRestore();
    write.mockRestore();
  });

  it('übergeht einen halben Eintrag im Speicher', () => {
    localStorage.setItem('pilzkarte.texte', '{kaputt');
    const setup = build();

    setup.catalog.restore();

    expect(setup.i18n.translate('nav.karte')).toBe('Karte');
  });

  it('schreibt eine Änderung sofort in die Oberfläche', async () => {
    const setup = build();
    const loaded = setup.catalog.load();
    setup.http.expectOne('/api/texts').flush(CATALOGUE);
    await loaded;

    const change = setup.catalog.change('nav.arten', 'de', 'Pilzarten');
    const request = setup.http.expectOne('/api/texts/nav.arten');
    request.flush({ ...SPECIES, values: { de: 'Pilzarten', en: 'Species' }, changed: true });
    await change;

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ locale: 'de', value: 'Pilzarten' });
    expect(setup.i18n.translate('nav.arten')).toBe('Pilzarten');
  });

  it('holt die Vorgabe zurück', async () => {
    const setup = build();
    const loaded = setup.catalog.load();
    setup.http.expectOne('/api/texts').flush(CATALOGUE);
    await loaded;

    const reset = setup.catalog.reset('nav.karte', 'de');
    const request = setup.http.expectOne('/api/texts/nav.karte?locale=de');
    request.flush({ ...MAP, values: { de: 'Karte', en: 'Chart' }, changed: false });
    await reset;

    expect(request.request.method).toBe('DELETE');
    expect(setup.i18n.translate('nav.karte')).toBe('Karte');
  });
});
