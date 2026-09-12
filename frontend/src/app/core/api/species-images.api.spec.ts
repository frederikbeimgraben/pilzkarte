import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { speciesImage } from '../../testing/species-images-fixture';
import { SpeciesImagesApi } from './species-images.api';

describe('SpeciesImagesApi', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('holt die freigegebenen Bilder einer Art', async () => {
    const api = TestBed.inject(SpeciesImagesApi);
    const answer = firstValueFrom(api.ofSpecies('steinpilz'));

    const request = TestBed.inject(HttpTestingController).expectOne('/api/species-images?species=steinpilz');
    expect(request.request.method).toBe('GET');
    request.flush([speciesImage()]);

    expect((await answer).map((image) => image.id)).toEqual(['bild-eins']);
  });
});
