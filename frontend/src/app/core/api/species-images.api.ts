import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { SpeciesImage } from './models';

/**
 * Die Bilder einer Art. Ein freigegebenes Bild liest jeder, auch ohne Konto;
 * der Pfad der Datei steht fertig in der Antwort.
 */
@Injectable({ providedIn: 'root' })
export class SpeciesImagesApi {
  private readonly api = inject(ApiClient);

  ofSpecies(slug: string): Observable<SpeciesImage[]> {
    return this.api.get<SpeciesImage[]>('/species-images', { species: slug });
  }
}
