import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Art, ArtenListe } from './models';

/** Die zwei Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class ArtenApi {
  private readonly api = inject(ApiClient);

  liste(): Observable<ArtenListe> {
    return this.api.get<ArtenListe>('/arten');
  }

  profil(slug: string): Observable<Art> {
    return this.api.get<Art>(`/arten/${encodeURIComponent(slug)}`);
  }
}
