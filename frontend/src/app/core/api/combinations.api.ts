import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Combination, CombinationInput, Page } from './models';

/** Die eigenen Kombinationen. Jede Route braucht ein Konto. */
@Injectable({ providedIn: 'root' })
export class CombinationsApi {
  private readonly api = inject(ApiClient);

  catalogue(): Observable<Page<Combination>> {
    return this.api.get<Page<Combination>>('/kombinationen');
  }

  create(input: CombinationInput): Observable<Combination> {
    return this.api.post<Combination>('/kombinationen', input);
  }

  update(id: string, patch: Partial<CombinationInput>): Observable<Combination> {
    return this.api.patch<Combination>(`/kombinationen/${encodeURIComponent(id)}`, patch);
  }

  /** Die Antwort ist leer; der Aufrufer wartet nur darauf, dass sie kommt. */
  remove(id: string): Observable<null> {
    return this.api.delete<null>(`/kombinationen/${encodeURIComponent(id)}`);
  }
}
