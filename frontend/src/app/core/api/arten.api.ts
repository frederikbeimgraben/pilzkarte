import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Art, ArtenListe } from './models';

/** Die zwei Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class ArtenApi {
  private readonly api = inject(ApiClient);

  /**
   * Ohne Angabe kommen nur die sammelbaren Arten. Die 224 Verwechslungsprofile
   * holt `sammelbar: false`, beide Töpfe zusammen `alle: true`.
   */
  liste(abfrage?: { sammelbar?: boolean; alle?: boolean }): Observable<ArtenListe> {
    return this.api.get<ArtenListe>('/arten', abfrage);
  }

  profil(slug: string): Observable<Art> {
    return this.api.get<Art>(`/arten/${encodeURIComponent(slug)}`);
  }
}
