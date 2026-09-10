import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type {
  Foto,
  Fund,
  FundAenderung,
  FundEingabe,
  GeteilterFund,
  Marker,
  MarkerAenderung,
  MarkerEingabe,
  Seite,
  Zone,
  ZoneAenderung,
  ZoneEingabe,
  ZonenWert,
} from './models';

/** Der Ausschnitt, in dem geteilte Funde gesucht werden: west,süd,ost,nord. */
export interface Rechteck {
  west: number;
  sued: number;
  ost: number;
  nord: number;
}

/** Höchstens drei Fotos hängen an einem Fund, so wie es das Backend prüft. */
export const FOTOS_JE_FUND = 3;

/** So viele Einträge holt eine Seite. Das Backend lässt bis 200 zu. */
const SEITE = 200;

function bbox(rechteck: Rechteck): string {
  return [rechteck.west, rechteck.sued, rechteck.ost, rechteck.nord].join(',');
}

/**
 * Funde, Marker, Zonen und ihre Fotos. Bis auf `geteilt` braucht jede Route
 * ein Konto; der Interceptor hängt das Token an.
 */
@Injectable({ providedIn: 'root' })
export class EintraegeApi {
  private readonly api = inject(ApiClient);

  funde(): Observable<Seite<Fund>> {
    return this.api.get<Seite<Fund>>('/funde', { limit: SEITE });
  }

  fundAnlegen(eingabe: FundEingabe): Observable<Fund> {
    return this.api.post<Fund>('/funde', eingabe);
  }

  fundAendern(id: string, aenderung: FundAenderung): Observable<Fund> {
    return this.api.patch<Fund>(`/funde/${encodeURIComponent(id)}`, aenderung);
  }

  fundLoeschen(id: string): Observable<null> {
    return this.api.delete<null>(`/funde/${encodeURIComponent(id)}`);
  }

  /** Auch ohne Konto lesbar. Ohne Rechteck kommt die ganze geteilte Karte. */
  geteilteFunde(rechteck?: Rechteck): Observable<Seite<GeteilterFund>> {
    return this.api.get<Seite<GeteilterFund>>('/funde/geteilt', {
      bbox: rechteck ? bbox(rechteck) : undefined,
      limit: SEITE,
    });
  }

  fotoAnlegen(fundId: string, datei: File): Observable<Foto> {
    return this.api.postDatei<Foto>(`/funde/${encodeURIComponent(fundId)}/fotos`, 'datei', datei);
  }

  fotoLaden(fundId: string, fotoId: string): Observable<Blob> {
    return this.api.getBlob(`/funde/${encodeURIComponent(fundId)}/fotos/${encodeURIComponent(fotoId)}`);
  }

  marker(): Observable<Seite<Marker>> {
    return this.api.get<Seite<Marker>>('/marker', { limit: SEITE });
  }

  markerAnlegen(eingabe: MarkerEingabe): Observable<Marker> {
    return this.api.post<Marker>('/marker', eingabe);
  }

  markerAendern(id: string, aenderung: MarkerAenderung): Observable<Marker> {
    return this.api.patch<Marker>(`/marker/${encodeURIComponent(id)}`, aenderung);
  }

  markerLoeschen(id: string): Observable<null> {
    return this.api.delete<null>(`/marker/${encodeURIComponent(id)}`);
  }

  zonen(): Observable<Seite<Zone>> {
    return this.api.get<Seite<Zone>>('/zonen', { limit: SEITE });
  }

  zoneAnlegen(eingabe: ZoneEingabe): Observable<Zone> {
    return this.api.post<Zone>('/zonen', eingabe);
  }

  zoneAendern(id: string, aenderung: ZoneAenderung): Observable<Zone> {
    return this.api.patch<Zone>(`/zonen/${encodeURIComponent(id)}`, aenderung);
  }

  zoneLoeschen(id: string): Observable<null> {
    return this.api.delete<null>(`/zonen/${encodeURIComponent(id)}`);
  }

  /** Das Flächenmittel der Vorhersage in der Zone, für genau Art und Woche. */
  zonenWert(id: string, art: string, jahr: number, woche: number): Observable<ZonenWert> {
    return this.api.get<ZonenWert>(`/zonen/${encodeURIComponent(id)}/wert`, { art, jahr, woche });
  }
}
