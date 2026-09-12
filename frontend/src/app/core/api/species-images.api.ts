import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { ImageState, ImageSubmission, Licence, Page, SpeciesImage } from './models';

/** Was neben der Datei im Formular steht. Fotograf und Lizenz sind Pflicht. */
export interface ImageInput {
  speciesSlug: string;
  photographer: string;
  licence: Licence;
  source?: string;
  takenOn?: string;
  caption?: string;
  /** Wahlfrei, und nur zusammen. Der Dienst rundet, bevor er speichert. */
  lat?: number;
  lon?: number;
}

/**
 * Die Bilder einer Art. Ein freigegebenes Bild liest jeder, auch ohne Konto;
 * der Pfad der Datei steht fertig in der Antwort. Alles Weitere hängt an
 * einem Recht oder an der eigenen Einreichung.
 */
@Injectable({ providedIn: 'root' })
export class SpeciesImagesApi {
  private readonly api = inject(ApiClient);

  ofSpecies(slug: string): Observable<SpeciesImage[]> {
    return this.api.get<SpeciesImage[]>('/species-images', { species: slug });
  }

  /** Reicht ein Bild zur Prüfung ein. Jede angemeldete Person darf das. */
  submit(input: ImageInput, file: File): Observable<ImageSubmission> {
    return this.api.postFile<ImageSubmission>('/species-images/submissions', 'file', file, { ...input });
  }

  /** Stellt ein Bild sofort an die Art. Dafür braucht es `image.upload`. */
  publish(input: ImageInput, file: File): Observable<ImageSubmission> {
    return this.api.postFile<ImageSubmission>('/species-images', 'file', file, { ...input });
  }

  mine(offset: number, limit: number): Observable<Page<ImageSubmission>> {
    return this.api.get<Page<ImageSubmission>>('/species-images/mine', { offset, limit });
  }

  /** Der Eingang der Prüfung. Braucht `image.review`. */
  submissions(state: ImageState, offset: number, limit: number): Observable<Page<ImageSubmission>> {
    return this.api.get<Page<ImageSubmission>>('/species-images/submissions', {
      state,
      offset,
      limit,
    });
  }

  approve(id: string): Observable<ImageSubmission> {
    return this.api.post<ImageSubmission>(`/species-images/${encodeURIComponent(id)}/approval`);
  }

  reject(id: string, reason: string): Observable<ImageSubmission> {
    return this.api.post<ImageSubmission>(`/species-images/${encodeURIComponent(id)}/rejection`, {
      reason,
    });
  }
}
