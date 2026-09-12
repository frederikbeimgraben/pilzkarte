import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Taxon, TaxonRank } from './models';

/** Der Endpunkt der Einordnung. Er ist offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class TaxonomyApi {
  private readonly api = inject(ApiClient);

  /** Eine Stufe mit Pfad, Nachbarn, untergeordneten Stufen und ihren Arten. */
  taxon(rank: TaxonRank, slug: string): Observable<Taxon> {
    return this.api.get<Taxon>(`/taxonomie/${rank}/${encodeURIComponent(slug)}`);
  }
}
