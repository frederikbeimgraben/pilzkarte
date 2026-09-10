import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { AuthStummel, authStummelAnbieter } from '../../testing/auth-stummel';
import { keineVerstoesse } from '../../testing/axe';
import { FUND, MARKER, ZONE, seite } from '../../testing/eintraege-fixture';
import { KartenAttrappe, MANIFEST_ROH } from '../../testing/karte-attrappen';
import { ArtenZustand } from '../arten/arten.zustand';
import { EintraegeZustand } from '../eintraege/eintraege.zustand';
import { KartenZustand } from '../karte/karten-zustand';
import { ObjektBlattComponent } from './objekt-blatt.component';

interface Aufbau {
  container: Element;
  karte: KartenAttrappe;
  zustand: KartenZustand;
  router: Router;
  http: HttpTestingController;
  aktualisiere: () => void;
}

async function aufbauen(): Promise<Aufbau> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MANIFEST_ROH) }),
  );
  const karte = new KartenAttrappe();
  const { container, detectChanges } = await render(ObjektBlattComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: KARTE_ADAPTER, useValue: karte },
      ...authStummelAnbieter(new AuthStummel()),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  // Der Katalog steht vor dem Blatt: sonst käme sein Name erst nach dem Test.
  TestBed.inject(ArtenZustand).ladeListe();
  http.expectOne('/api/arten').flush(ARTEN_LISTE);
  const eintraege = TestBed.inject(EintraegeZustand);
  const geladen = eintraege.lade();
  await vi.waitFor(() => {
    http.expectOne('/api/funde?limit=200').flush(seite([FUND]));
  });
  http.expectOne('/api/marker?limit=200').flush(seite([MARKER]));
  http.expectOne('/api/zonen?limit=200').flush(seite([ZONE]));
  await geladen;
  detectChanges();
  return {
    container,
    karte,
    zustand: TestBed.inject(KartenZustand),
    router: TestBed.inject(Router),
    http,
    aktualisiere: detectChanges,
  };
}

describe('ObjektBlattComponent', () => {
  it('zeigt nichts, solange kein Objekt in der Adresse steht', async () => {
    const aufbau = await aufbauen();

    expect(aufbau.container.querySelector('.objekt')).toBeNull();
  });

  it('öffnet den Fund aus der Adresse', async () => {
    const aufbau = await aufbauen();

    aufbau.zustand.objekt.set({ art: 'fund', id: FUND.id });
    aufbau.aktualisiere();

    expect(screen.getByRole('heading', { name: 'Steinpilz' })).toBeInTheDocument();
    await keineVerstoesse(aufbau.container);
  });

  it('öffnet Marker und Zone aus derselben Adresse', async () => {
    const aufbau = await aufbauen();

    aufbau.zustand.objekt.set({ art: 'marker', id: MARKER.id });
    aufbau.aktualisiere();
    expect(screen.getByRole('heading', { name: 'Alter Fichtenhang' })).toBeInTheDocument();

    aufbau.zustand.objekt.set({ art: 'zone', id: ZONE.id });
    aufbau.aktualisiere();
    expect(screen.getByRole('heading', { name: 'Schönbuch Nord' })).toBeInTheDocument();
  });

  it('sagt es, wenn den Eintrag niemand mehr kennt', async () => {
    const aufbau = await aufbauen();

    aufbau.zustand.objekt.set({ art: 'fund', id: 'weg' });
    aufbau.aktualisiere();

    expect(screen.getByText('Diesen Eintrag gibt es nicht mehr.')).toBeInTheDocument();
  });

  it('fährt auf die Karte und schließt das Blatt', async () => {
    const aufbau = await aufbauen();
    aufbau.zustand.objekt.set({ art: 'marker', id: MARKER.id });
    aufbau.aktualisiere();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte anzeigen' }));

    expect(aufbau.karte.fluege[0].ziel).toEqual([MARKER.lon, MARKER.lat]);
    expect(aufbau.router.url).not.toContain('objekt=');
  });

  it('schließt, wenn ein Objekt gelöscht wurde', async () => {
    const aufbau = await aufbauen();
    aufbau.zustand.objekt.set({ art: 'marker', id: MARKER.id });
    aufbau.aktualisiere();

    await userEvent.click(screen.getByRole('button', { name: 'Marker löschen' }));
    aufbau.aktualisiere();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await vi.waitFor(() => {
      aufbau.http.expectOne(`/api/marker/${MARKER.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(aufbau.router.url).not.toContain('objekt=');
    });
  });
});
