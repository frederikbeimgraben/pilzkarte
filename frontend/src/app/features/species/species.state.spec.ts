import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SPECIES_LIST, STEINPILZ } from '../../testing/species-fixture';
import { SpeciesState } from './species.state';

function build(): { state: SpeciesState; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { state: TestBed.inject(SpeciesState), http: TestBed.inject(HttpTestingController) };
}

describe('ArtenZustand', () => {
  it('holt die Liste einmal und behält sie', () => {
    const { state, http } = build();

    state.loadCatalogue();
    state.loadCatalogue();
    http.expectOne('/api/arten').flush(SPECIES_LIST);
    state.loadCatalogue();

    expect(state.catalogue()?.arten).toHaveLength(4);
    http.verify();
  });

  it('lässt eine gescheiterte Liste einen zweiten Versuch zu', () => {
    const { state, http } = build();

    state.loadCatalogue();
    http.expectOne('/api/arten').flush('', { status: 503, statusText: 'Service Unavailable' });
    state.loadCatalogue();
    http.expectOne('/api/arten').flush(SPECIES_LIST);

    expect(state.catalogue()).not.toBeNull();
  });

  it('merkt sich ein Profil je Slug', () => {
    const { state, http } = build();

    state.loadProfile('steinpilz');
    state.loadProfile('steinpilz');
    http.expectOne('/api/arten/steinpilz').flush(STEINPILZ);
    state.loadProfile('steinpilz');

    expect(state.profile().get('steinpilz')?.name).toBe('Steinpilz');
    http.verify();
  });

  it('merkt einen unbekannten Slug und fragt nicht noch einmal', () => {
    const { state, http } = build();

    state.loadProfile('gibtsnicht');
    http
      .expectOne('/api/arten/gibtsnicht')
      .flush(
        { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    state.loadProfile('gibtsnicht');

    expect(state.unknown().has('gibtsnicht')).toBe(true);
    expect(state.profile().has('gibtsnicht')).toBe(false);
    http.verify();
  });

  it('führt die aktive Art', () => {
    const { state } = build();

    expect(state.activeSpecies()).toBeNull();
    state.select('steinpilz');

    expect(state.activeSpecies()).toBe('steinpilz');
  });
});
