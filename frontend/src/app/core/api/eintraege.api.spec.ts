import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FUND, MARKER, ZONE, seite } from '../../testing/eintraege-fixture';
import { EintraegeApi } from './eintraege.api';

interface Aufbau {
  api: EintraegeApi;
  http: HttpTestingController;
}

function aufbauen(): Aufbau {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(EintraegeApi), http: TestBed.inject(HttpTestingController) };
}

describe('EintraegeApi', () => {
  it('holt die eigenen Listen mit einer Seitengröße', () => {
    const { api, http } = aufbauen();

    api.funde().subscribe();
    api.marker().subscribe();
    api.zonen().subscribe();

    expect(http.expectOne('/api/funde?limit=200').request.method).toBe('GET');
    http.expectOne('/api/marker?limit=200').flush(seite([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(seite([ZONE]));
  });

  it('schreibt das Rechteck der geteilten Funde als bbox', () => {
    const { api, http } = aufbauen();

    api.geteilteFunde({ west: 9, sued: 48, ost: 10, nord: 49 }).subscribe();

    http.expectOne('/api/funde/geteilt?bbox=9,48,10,49&limit=200').flush(seite([]));
  });

  it('lässt die bbox weg, wenn kein Ausschnitt gefragt ist', () => {
    const { api, http } = aufbauen();

    api.geteilteFunde().subscribe();

    http.expectOne('/api/funde/geteilt?limit=200').flush(seite([]));
  });

  it('legt einen Fund an, ändert und löscht ihn', () => {
    const { api, http } = aufbauen();

    api.fundAnlegen({ ...FUND, sichtbarkeit: 'privat' }).subscribe();
    http.expectOne({ url: '/api/funde', method: 'POST' }).flush(FUND);

    api.fundAendern(FUND.id, { anzahl: 4 }).subscribe();
    http.expectOne({ url: `/api/funde/${FUND.id}`, method: 'PATCH' }).flush(FUND);

    api.fundLoeschen(FUND.id).subscribe();
    http.expectOne({ url: `/api/funde/${FUND.id}`, method: 'DELETE' }).flush(null);
  });

  it('hängt ein Foto als multipart an und holt es als Datei zurück', () => {
    const { api, http } = aufbauen();

    api.fotoAnlegen(FUND.id, new File(['bild'], 'pilz.jpg', { type: 'image/jpeg' })).subscribe();
    const anfrage = http.expectOne({ url: `/api/funde/${FUND.id}/fotos`, method: 'POST' });
    expect(anfrage.request.body).toBeInstanceOf(FormData);
    expect((anfrage.request.body as FormData).get('datei')).toBeInstanceOf(File);
    anfrage.flush(FUND.fotos[0]);

    api.fotoLaden(FUND.id, 'foto-eins').subscribe();
    const bild = http.expectOne(`/api/funde/${FUND.id}/fotos/foto-eins`);
    expect(bild.request.responseType).toBe('blob');
    bild.flush(new Blob(['bild']));
  });

  it('legt Marker und Zonen an, ändert und löscht sie', () => {
    const { api, http } = aufbauen();

    api.markerAnlegen({ ...MARKER }).subscribe();
    http.expectOne({ url: '/api/marker', method: 'POST' }).flush(MARKER);
    api.markerAendern(MARKER.id, { name: 'Neu' }).subscribe();
    http.expectOne({ url: `/api/marker/${MARKER.id}`, method: 'PATCH' }).flush(MARKER);
    api.markerLoeschen(MARKER.id).subscribe();
    http.expectOne({ url: `/api/marker/${MARKER.id}`, method: 'DELETE' }).flush(null);

    api.zoneAnlegen({ ...ZONE }).subscribe();
    http.expectOne({ url: '/api/zonen', method: 'POST' }).flush(ZONE);
    api.zoneAendern(ZONE.id, { name: 'Neu' }).subscribe();
    http.expectOne({ url: `/api/zonen/${ZONE.id}`, method: 'PATCH' }).flush(ZONE);
    api.zoneLoeschen(ZONE.id).subscribe();
    http.expectOne({ url: `/api/zonen/${ZONE.id}`, method: 'DELETE' }).flush(null);
  });

  it('fragt den Zonenwert mit Art, Jahr und Woche', () => {
    const { api, http } = aufbauen();

    api.zonenWert(ZONE.id, 'steinpilz', 2025, 40).subscribe();

    http.expectOne(`/api/zonen/${ZONE.id}/wert?art=steinpilz&jahr=2025&woche=40`).flush({
      art: 'steinpilz',
      woche: { jahr: 2025, woche: 40 },
      flaechenmittel: 18,
      punkte: 12,
      eigeneFunde: 2,
    });
  });
});
