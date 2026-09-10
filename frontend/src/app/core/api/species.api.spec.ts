import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SPECIES_LIST, STEINPILZ } from '../../testing/species-fixture';
import { SpeciesApi } from './species.api';
import type { Species, SpeciesCatalogue } from './models';

function build(): { api: SpeciesApi; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(SpeciesApi), http: TestBed.inject(HttpTestingController) };
}

describe('ArtenApi', () => {
  it('liest die Liste unter /api/arten', () => {
    const { api, http } = build();
    let got: SpeciesCatalogue | null = null;

    api.catalogue().subscribe((catalogue) => (got = catalogue));
    http.expectOne('/api/arten').flush(SPECIES_LIST);

    expect(got).toEqual(SPECIES_LIST);
    http.verify();
  });

  it('liest ein Profil unter seinem Slug', () => {
    const { api, http } = build();
    let got: Species | null = null;

    api.profile('steinpilz').subscribe((art) => (got = art));
    http.expectOne('/api/arten/steinpilz').flush(STEINPILZ);

    expect(got).toEqual(STEINPILZ);
    http.verify();
  });

  it('kodiert einen Slug, der in eine URL nicht roh gehört', () => {
    const { api, http } = build();

    api.profile('rot/braun').subscribe();

    expect(http.expectOne('/api/arten/rot%2Fbraun').request.method).toBe('GET');
  });
});
