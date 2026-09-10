import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FIND, MARKER, ZONE, page } from '../../testing/entries-fixture';
import { EntriesApi } from './entries.api';

interface Setup {
  api: EntriesApi;
  http: HttpTestingController;
}

function build(): Setup {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(EntriesApi), http: TestBed.inject(HttpTestingController) };
}

describe('EintraegeApi', () => {
  it('holt die eigenen Listen mit einer Seitengröße', () => {
    const { api, http } = build();

    api.finds().subscribe();
    api.marker().subscribe();
    api.zones().subscribe();

    expect(http.expectOne('/api/funde?limit=200').request.method).toBe('GET');
    http.expectOne('/api/marker?limit=200').flush(page([MARKER]));
    http.expectOne('/api/zonen?limit=200').flush(page([ZONE]));
  });

  it('schreibt das Rechteck der geteilten Funde als bbox', () => {
    const { api, http } = build();

    api.sharedFinds({ west: 9, south: 48, ost: 10, nord: 49 }).subscribe();

    http.expectOne('/api/funde/geteilt?bbox=9,48,10,49&limit=200').flush(page([]));
  });

  it('lässt die bbox weg, wenn kein Ausschnitt gefragt ist', () => {
    const { api, http } = build();

    api.sharedFinds().subscribe();

    http.expectOne('/api/funde/geteilt?limit=200').flush(page([]));
  });

  it('legt einen Fund an, ändert und löscht ihn', () => {
    const { api, http } = build();

    api.createFind({ ...FIND, sichtbarkeit: 'privat' }).subscribe();
    http.expectOne({ url: '/api/funde', method: 'POST' }).flush(FIND);

    api.patchFind(FIND.id, { anzahl: 4 }).subscribe();
    http.expectOne({ url: `/api/funde/${FIND.id}`, method: 'PATCH' }).flush(FIND);

    api.deleteFind(FIND.id).subscribe();
    http.expectOne({ url: `/api/funde/${FIND.id}`, method: 'DELETE' }).flush(null);
  });

  it('hängt ein Foto als multipart an und holt es als Datei zurück', () => {
    const { api, http } = build();

    api.addPhoto(FIND.id, new File(['bild'], 'pilz.jpg', { type: 'image/jpeg' })).subscribe();
    const request = http.expectOne({ url: `/api/funde/${FIND.id}/fotos`, method: 'POST' });
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('datei')).toBeInstanceOf(File);
    request.flush(FIND.fotos[0]);

    api.loadPhoto(FIND.id, 'foto-eins').subscribe();
    const shot = http.expectOne(`/api/funde/${FIND.id}/fotos/foto-eins`);
    expect(shot.request.responseType).toBe('blob');
    shot.flush(new Blob(['bild']));
  });

  it('legt Marker und Zonen an, ändert und löscht sie', () => {
    const { api, http } = build();

    api.createMarker({ ...MARKER }).subscribe();
    http.expectOne({ url: '/api/marker', method: 'POST' }).flush(MARKER);
    api.patchMarker(MARKER.id, { name: 'Neu' }).subscribe();
    http.expectOne({ url: `/api/marker/${MARKER.id}`, method: 'PATCH' }).flush(MARKER);
    api.deleteMarker(MARKER.id).subscribe();
    http.expectOne({ url: `/api/marker/${MARKER.id}`, method: 'DELETE' }).flush(null);

    api.createZone({ ...ZONE }).subscribe();
    http.expectOne({ url: '/api/zonen', method: 'POST' }).flush(ZONE);
    api.patchZone(ZONE.id, { name: 'Neu' }).subscribe();
    http.expectOne({ url: `/api/zonen/${ZONE.id}`, method: 'PATCH' }).flush(ZONE);
    api.deleteZone(ZONE.id).subscribe();
    http.expectOne({ url: `/api/zonen/${ZONE.id}`, method: 'DELETE' }).flush(null);
  });

  it('schickt die Freigabe für das Training mit', () => {
    const { api, http } = build();

    api.createFind({ ...FIND, sichtbarkeit: 'privat', fuerTraining: true }).subscribe();
    const create = http.expectOne({ url: '/api/funde', method: 'POST' });
    expect(create.request.body).toMatchObject({ fuerTraining: true });
    create.flush(FIND);

    api.patchFind(FIND.id, { fuerTraining: false }).subscribe();
    const update = http.expectOne({ url: `/api/funde/${FIND.id}`, method: 'PATCH' });
    expect(update.request.body).toMatchObject({ fuerTraining: false });
    update.flush(FIND);
  });

  it('fragt den Zonenwert mit Art, Jahr und Woche', () => {
    const { api, http } = build();

    api.zoneValue(ZONE.id, 'steinpilz', 2025, 40).subscribe();

    http.expectOne(`/api/zonen/${ZONE.id}/wert?art=steinpilz&jahr=2025&woche=40`).flush({
      art: 'steinpilz',
      woche: { jahr: 2025, woche: 40 },
      flaechenmittel: 18,
      punkte: 12,
      eigeneFunde: 2,
    });
  });
});
