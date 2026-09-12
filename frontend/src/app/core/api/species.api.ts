import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Species, SpeciesCatalogue } from './models';

/** Die zwei Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class SpeciesApi {
  private readonly api = inject(ApiClient);

  /**
   * Ohne Angabe kommen nur die sammelbaren Arten. Die 221 Verwechslungsprofile
   * holt `sammelbar: false`, beide Töpfe zusammen `alle: true`.
   */
  catalogue(query?: { sammelbar?: boolean; alle?: boolean }): Observable<SpeciesCatalogue> {
    return this.api.get<SpeciesCatalogue>('/arten', query);
  }

  profile(slug: string): Observable<Species> {
    return this.api.get<Species>(`/arten/${encodeURIComponent(slug)}`);
  }
}
