import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SPECIES_LIST, STEINPILZ } from '../../testing/species-fixture';
import { speciesImage } from '../../testing/species-images-fixture';
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

  it('holt die Bilder einer Art einmal und behält sie', () => {
    const { state, http } = build();

    state.loadImages('steinpilz');
    state.loadImages('steinpilz');
    http.expectOne('/api/species-images?species=steinpilz').flush([speciesImage()]);
    state.loadImages('steinpilz');

    expect(state.images().get('steinpilz')).toHaveLength(1);
    http.verify();
  });

  it('merkt sich auch eine Art ganz ohne Bild', () => {
    const { state, http } = build();

    state.loadImages('parasol');
    http.expectOne('/api/species-images?species=parasol').flush([]);
    state.loadImages('parasol');

    expect(state.images().get('parasol')).toEqual([]);
    http.verify();
  });

  it('lässt einen gescheiterten Bildabruf einen zweiten Versuch zu', () => {
    const { state, http } = build();

    state.loadImages('steinpilz');
    http
      .expectOne('/api/species-images?species=steinpilz')
      .flush('', { status: 503, statusText: 'Service Unavailable' });
    state.loadImages('steinpilz');
    http.expectOne('/api/species-images?species=steinpilz').flush([speciesImage()]);

    expect(state.images().get('steinpilz')).toHaveLength(1);
  });
});
