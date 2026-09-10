import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { FIND, SHARED_FIND, MARKER, ZONE, page } from '../../testing/entries-fixture';
import { MapAdapterDouble } from '../../testing/map-doubles';
import { EntriesState } from '../entries/entries.state';
import { MapState } from '../map/map.state';
import { MapObjectsDirective } from './map-objects.directive';

@Component({
  imports: [MapObjectsDirective],
  template: `<div appMapObjects></div>`,
})
class HostComponent {}

interface Setup {
  map: MapAdapterDouble;
  state: MapState;
  router: Router;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  const map = new MapAdapterDouble();
  const { detectChanges } = await render(HostComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: MAP_ADAPTER, useValue: map },
      ...authStubProviders(new AuthStub()),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const eintraege = TestBed.inject(EntriesState);
  const loaded = eintraege.load();
  await vi.waitFor(() => {
    http.expectOne('/api/funde?limit=200').flush(page([FIND]));
  });
  http.expectOne('/api/marker?limit=200').flush(page([MARKER]));
  http.expectOne('/api/zonen?limit=200').flush(page([ZONE]));
  await loaded;
  const geteilt = eintraege.loadShared();
  await vi.waitFor(() => {
    http
      .expectOne('/api/funde/geteilt?limit=200')
      .flush(page([SHARED_FIND, { ...FIND, eigen: true, gerundet: false, melder: 'Frederik' }]));
  });
  await geteilt;
  detectChanges();
  return {
    map,
    state: TestBed.inject(MapState),
    router: TestBed.inject(Router),
    refresh: detectChanges,
  };
}

describe('KartenObjekteDirective', () => {
  it('legt Zonen, Marker und Funde in ihrer Farbe auf die Karte', async () => {
    const setup = await build();

    expect(setup.map.layers.get('zonen')?.features[0].properties?.['farbe']).toBe('#004225');
    expect(setup.map.layers.get('marker')?.features[0].properties?.['farbe']).toBe('#185468');
    expect(setup.map.layers.get('funde')?.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [FIND.lon, FIND.lat],
    });
  });

  it('zeichnet einen gerundeten fremden Fund und lässt die eigenen weg', async () => {
    const setup = await build();

    const geteilt = setup.map.layers.get('geteilteFunde');
    expect(geteilt?.features).toHaveLength(1);
    expect(geteilt?.features[0].properties?.['gerundet']).toBe(true);
  });

  it('nimmt eine Ebene weg, sobald der Ebenen-Knopf sie abschaltet', async () => {
    const setup = await build();

    setup.state.showZones.set(false);
    setup.state.showMarkers.set(false);
    setup.state.showSharedFinds.set(false);
    setup.refresh();

    expect(setup.map.layers.has('zonen')).toBe(false);
    expect(setup.map.layers.has('marker')).toBe(false);
    expect(setup.map.layers.has('geteilteFunde')).toBe(false);
    expect(setup.map.layers.has('funde')).toBe(true);
  });

  it('öffnet auf einen Tipp das Objekt-Blatt', async () => {
    const setup = await build();

    setup.map.chosen?.('funde', FIND.id);
    await vi.waitFor(() => {
      expect(setup.router.url).toContain(`objekt=fund:${FIND.id}`);
    });

    setup.map.chosen?.('marker', MARKER.id);
    await vi.waitFor(() => {
      expect(setup.router.url).toContain(`objekt=marker:${MARKER.id}`);
    });

    setup.map.chosen?.('zonen', ZONE.id);
    await vi.waitFor(() => {
      expect(setup.router.url).toContain(`objekt=zone:${ZONE.id}`);
    });
  });

  it('öffnet für einen fremden geteilten Fund kein Blatt', async () => {
    const setup = await build();

    setup.map.chosen?.('geteilteFunde', SHARED_FIND.id);

    expect(setup.router.url).not.toContain('objekt=');
  });
});
