import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ARTEN_LISTE, STEINPILZ } from '../../testing/arten-fixture';
import { ArtenZustand } from './arten.zustand';

function aufbauen(): { zustand: ArtenZustand; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { zustand: TestBed.inject(ArtenZustand), http: TestBed.inject(HttpTestingController) };
}

describe('ArtenZustand', () => {
  it('holt die Liste einmal und behält sie', () => {
    const { zustand, http } = aufbauen();

    zustand.ladeListe();
    zustand.ladeListe();
    http.expectOne('/api/arten').flush(ARTEN_LISTE);
    zustand.ladeListe();

    expect(zustand.liste()?.arten).toHaveLength(3);
    http.verify();
  });

  it('lässt eine gescheiterte Liste einen zweiten Versuch zu', () => {
    const { zustand, http } = aufbauen();

    zustand.ladeListe();
    http.expectOne('/api/arten').flush('', { status: 503, statusText: 'Service Unavailable' });
    zustand.ladeListe();
    http.expectOne('/api/arten').flush(ARTEN_LISTE);

    expect(zustand.liste()).not.toBeNull();
  });

  it('merkt sich ein Profil je Slug', () => {
    const { zustand, http } = aufbauen();

    zustand.ladeProfil('steinpilz');
    zustand.ladeProfil('steinpilz');
    http.expectOne('/api/arten/steinpilz').flush(STEINPILZ);
    zustand.ladeProfil('steinpilz');

    expect(zustand.profile().get('steinpilz')?.name).toBe('Steinpilz');
    http.verify();
  });

  it('merkt einen unbekannten Slug und fragt nicht noch einmal', () => {
    const { zustand, http } = aufbauen();

    zustand.ladeProfil('gibtsnicht');
    http
      .expectOne('/api/arten/gibtsnicht')
      .flush(
        { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    zustand.ladeProfil('gibtsnicht');

    expect(zustand.unbekannt().has('gibtsnicht')).toBe(true);
    expect(zustand.profile().has('gibtsnicht')).toBe(false);
    http.verify();
  });

  it('führt die aktive Art', () => {
    const { zustand } = aufbauen();

    expect(zustand.aktiveArt()).toBeNull();
    zustand.waehle('steinpilz');

    expect(zustand.aktiveArt()).toBe('steinpilz');
  });
});
