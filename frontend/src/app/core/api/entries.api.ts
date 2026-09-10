import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type {
  Photo,
  Find,
  FindPatch,
  FindInput,
  SharedFind,
  Marker,
  MarkerPatch,
  MarkerInput,
  Page,
  Zone,
  ZonePatch,
  ZoneInput,
  ZoneValue,
} from './models';

/** Der Ausschnitt, in dem geteilte Funde gesucht werden: west,süd,ost,nord. */
export interface Rect {
  west: number;
  south: number;
  ost: number;
  nord: number;
}

/** Höchstens drei Fotos hängen an einem Fund, so wie es das Backend prüft. */
export const PHOTOS_PER_FIND = 3;

/** So viele Einträge holt eine Seite. Das Backend lässt bis 200 zu. */
const PAGE_SIZE = 200;

function bbox(rect: Rect): string {
  return [rect.west, rect.south, rect.ost, rect.nord].join(',');
}

/**
 * Funde, Marker, Zonen und ihre Fotos. Bis auf `geteilt` braucht jede Route
 * ein Konto; der Interceptor hängt das Token an.
 */
@Injectable({ providedIn: 'root' })
export class EntriesApi {
  private readonly api = inject(ApiClient);

  finds(): Observable<Page<Find>> {
    return this.api.get<Page<Find>>('/funde', { limit: PAGE_SIZE });
  }

  createFind(input: FindInput): Observable<Find> {
    return this.api.post<Find>('/funde', input);
  }

  patchFind(id: string, patch: FindPatch): Observable<Find> {
    return this.api.patch<Find>(`/funde/${encodeURIComponent(id)}`, patch);
  }

  deleteFind(id: string): Observable<null> {
    return this.api.delete<null>(`/funde/${encodeURIComponent(id)}`);
  }

  /** Auch ohne Konto lesbar. Ohne Rechteck kommt die ganze geteilte Karte. */
  sharedFinds(rect?: Rect): Observable<Page<SharedFind>> {
    return this.api.get<Page<SharedFind>>('/funde/geteilt', {
      bbox: rect ? bbox(rect) : undefined,
      limit: PAGE_SIZE,
    });
  }

  addPhoto(findId: string, file: File): Observable<Photo> {
    return this.api.postFile<Photo>(`/funde/${encodeURIComponent(findId)}/fotos`, 'datei', file);
  }

  loadPhoto(findId: string, photoId: string): Observable<Blob> {
    return this.api.getBlob(`/funde/${encodeURIComponent(findId)}/fotos/${encodeURIComponent(photoId)}`);
  }

  marker(): Observable<Page<Marker>> {
    return this.api.get<Page<Marker>>('/marker', { limit: PAGE_SIZE });
  }

  createMarker(input: MarkerInput): Observable<Marker> {
    return this.api.post<Marker>('/marker', input);
  }

  patchMarker(id: string, patch: MarkerPatch): Observable<Marker> {
    return this.api.patch<Marker>(`/marker/${encodeURIComponent(id)}`, patch);
  }

  deleteMarker(id: string): Observable<null> {
    return this.api.delete<null>(`/marker/${encodeURIComponent(id)}`);
  }

  zones(): Observable<Page<Zone>> {
    return this.api.get<Page<Zone>>('/zonen', { limit: PAGE_SIZE });
  }

  createZone(input: ZoneInput): Observable<Zone> {
    return this.api.post<Zone>('/zonen', input);
  }

  patchZone(id: string, patch: ZonePatch): Observable<Zone> {
    return this.api.patch<Zone>(`/zonen/${encodeURIComponent(id)}`, patch);
  }

  deleteZone(id: string): Observable<null> {
    return this.api.delete<null>(`/zonen/${encodeURIComponent(id)}`);
  }

  /** Das Flächenmittel der Vorhersage in der Zone, für genau Art und Woche. */
  zoneValue(id: string, art: string, jahr: number, woche: number): Observable<ZoneValue> {
    return this.api.get<ZoneValue>(`/zonen/${encodeURIComponent(id)}/wert`, { art, jahr, woche });
  }
}
