import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND, MARKER, ZONE, page } from '../../testing/entries-fixture';
import { MapAdapterDouble, RAW_MANIFEST } from '../../testing/map-doubles';
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { MapState } from '../map/map.state';
import { ObjectSheetComponent } from './object-sheet.component';

interface Setup {
  container: Element;
  map: MapAdapterDouble;
  state: MapState;
  router: Router;
  http: HttpTestingController;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(RAW_MANIFEST) }),
  );
  const map = new MapAdapterDouble();
  const { container, detectChanges } = await render(ObjectSheetComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: MAP_ADAPTER, useValue: map },
      ...authStubProviders(new AuthStub()),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  // Der Katalog steht vor dem Blatt: sonst käme sein Name erst nach dem Test.
  TestBed.inject(SpeciesState).loadCatalogue();
  http.expectOne('/api/arten').flush(SPECIES_LIST);
  const eintraege = TestBed.inject(EntriesState);
  const loaded = eintraege.load();
  await vi.waitFor(() => {
    http.expectOne('/api/funde?limit=200').flush(page([FIND]));
  });
  http.expectOne('/api/marker?limit=200').flush(page([MARKER]));
  http.expectOne('/api/zonen?limit=200').flush(page([ZONE]));
  await loaded;
  detectChanges();
  return {
    container,
    map,
    state: TestBed.inject(MapState),
    router: TestBed.inject(Router),
    http,
    refresh: detectChanges,
  };
}

describe('ObjektBlattComponent', () => {
  it('zeigt nichts, solange kein Objekt in der Adresse steht', async () => {
    const setup = await build();

    expect(setup.container.querySelector('.object')).toBeNull();
  });

  it('öffnet den Fund aus der Adresse', async () => {
    const setup = await build();

    setup.state.object.set({ art: 'fund', id: FIND.id });
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Steinpilz' })).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('öffnet Marker und Zone aus derselben Adresse', async () => {
    const setup = await build();

    setup.state.object.set({ art: 'marker', id: MARKER.id });
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Alter Fichtenhang' })).toBeInTheDocument();

    setup.state.object.set({ art: 'zone', id: ZONE.id });
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Schönbuch Nord' })).toBeInTheDocument();
  });

  it('sagt es, wenn den Eintrag niemand mehr kennt', async () => {
    const setup = await build();

    setup.state.object.set({ art: 'fund', id: 'weg' });
    setup.refresh();

    expect(screen.getByText('Diesen Eintrag gibt es nicht mehr.')).toBeInTheDocument();
  });

  it('fährt auf die Karte und schließt das Blatt', async () => {
    const setup = await build();
    setup.state.object.set({ art: 'marker', id: MARKER.id });
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte anzeigen' }));

    expect(setup.map.flights[0].target).toEqual([MARKER.lon, MARKER.lat]);
    expect(setup.router.url).not.toContain('objekt=');
  });

  it('schließt, wenn ein Objekt gelöscht wurde', async () => {
    const setup = await build();
    setup.state.object.set({ art: 'marker', id: MARKER.id });
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Marker löschen' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/marker/${MARKER.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.router.url).not.toContain('objekt=');
    });
  });
});
