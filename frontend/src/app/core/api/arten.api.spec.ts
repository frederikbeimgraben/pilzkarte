import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ARTEN_LISTE, STEINPILZ } from '../../testing/arten-fixture';
import { ArtenApi } from './arten.api';
import type { Art, ArtenListe } from './models';

function aufbauen(): { api: ArtenApi; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(ArtenApi), http: TestBed.inject(HttpTestingController) };
}

describe('ArtenApi', () => {
  it('liest die Liste unter /api/arten', () => {
    const { api, http } = aufbauen();
    let gelesen: ArtenListe | null = null;

    api.liste().subscribe((liste) => (gelesen = liste));
    http.expectOne('/api/arten').flush(ARTEN_LISTE);

    expect(gelesen).toEqual(ARTEN_LISTE);
    http.verify();
  });

  it('liest ein Profil unter seinem Slug', () => {
    const { api, http } = aufbauen();
    let gelesen: Art | null = null;

    api.profil('steinpilz').subscribe((art) => (gelesen = art));
    http.expectOne('/api/arten/steinpilz').flush(STEINPILZ);

    expect(gelesen).toEqual(STEINPILZ);
    http.verify();
  });

  it('kodiert einen Slug, der in eine URL nicht roh gehört', () => {
    const { api, http } = aufbauen();

    api.profil('rot/braun').subscribe();

    expect(http.expectOne('/api/arten/rot%2Fbraun').request.method).toBe('GET');
  });
});
