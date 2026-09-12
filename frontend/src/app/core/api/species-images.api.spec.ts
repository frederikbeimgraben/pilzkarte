import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { imageSubmission, speciesImage } from '../../testing/species-images-fixture';
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

  it('reicht Datei und Angaben in einem Formular ein', async () => {
    const api = TestBed.inject(SpeciesImagesApi);
    const file = new File(['x'], 'pilz.jpg', { type: 'image/jpeg' });
    const answer = firstValueFrom(
      api.submit({ speciesSlug: 'steinpilz', photographer: 'Marie Weber', licence: 'cc-by-4' }, file),
    );

    const request = TestBed.inject(HttpTestingController).expectOne('/api/species-images/submissions');
    const body = request.request.body as FormData;
    expect(body.get('photographer')).toBe('Marie Weber');
    expect(body.get('licence')).toBe('cc-by-4');
    request.flush(imageSubmission());

    expect((await answer).state).toBe('submitted');
  });

  it('gibt frei und lehnt mit Grund ab', () => {
    const api = TestBed.inject(SpeciesImagesApi);
    const http = TestBed.inject(HttpTestingController);

    void firstValueFrom(api.approve('bild-eins'));
    http.expectOne('/api/species-images/bild-eins/approval').flush(imageSubmission());
    void firstValueFrom(api.reject('bild-eins', 'Unscharf'));
    const rejection = http.expectOne('/api/species-images/bild-eins/rejection');

    expect(rejection.request.body).toEqual({ reason: 'Unscharf' });
  });
});
