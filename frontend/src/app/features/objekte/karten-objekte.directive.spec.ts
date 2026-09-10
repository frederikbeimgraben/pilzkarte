import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import { AuthStummel, authStummelAnbieter } from '../../testing/auth-stummel';
import { FUND, GETEILTER_FUND, MARKER, ZONE, seite } from '../../testing/eintraege-fixture';
import { KartenAttrappe } from '../../testing/karte-attrappen';
import { EintraegeZustand } from '../eintraege/eintraege.zustand';
import { KartenZustand } from '../karte/karten-zustand';
import { KartenObjekteDirective } from './karten-objekte.directive';

@Component({
  imports: [KartenObjekteDirective],
  template: `<div appKartenObjekte></div>`,
})
class WirtComponent {}

interface Aufbau {
  karte: KartenAttrappe;
  zustand: KartenZustand;
  router: Router;
  aktualisiere: () => void;
}

async function aufbauen(): Promise<Aufbau> {
  const karte = new KartenAttrappe();
  const { detectChanges } = await render(WirtComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: KARTE_ADAPTER, useValue: karte },
      ...authStummelAnbieter(new AuthStummel()),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const eintraege = TestBed.inject(EintraegeZustand);
  const geladen = eintraege.lade();
  await vi.waitFor(() => {
    http.expectOne('/api/funde?limit=200').flush(seite([FUND]));
  });
  http.expectOne('/api/marker?limit=200').flush(seite([MARKER]));
  http.expectOne('/api/zonen?limit=200').flush(seite([ZONE]));
  await geladen;
  const geteilt = eintraege.ladeGeteilte();
  await vi.waitFor(() => {
    http
      .expectOne('/api/funde/geteilt?limit=200')
      .flush(seite([GETEILTER_FUND, { ...FUND, eigen: true, gerundet: false, melder: 'Frederik' }]));
  });
  await geteilt;
  detectChanges();
  return {
    karte,
    zustand: TestBed.inject(KartenZustand),
    router: TestBed.inject(Router),
    aktualisiere: detectChanges,
  };
}

describe('KartenObjekteDirective', () => {
  it('legt Zonen, Marker und Funde in ihrer Farbe auf die Karte', async () => {
    const aufbau = await aufbauen();

    expect(aufbau.karte.ebenen.get('zonen')?.features[0].properties?.['farbe']).toBe('#004225');
    expect(aufbau.karte.ebenen.get('marker')?.features[0].properties?.['farbe']).toBe('#185468');
    expect(aufbau.karte.ebenen.get('funde')?.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [FUND.lon, FUND.lat],
    });
  });

  it('zeichnet einen gerundeten fremden Fund und lässt die eigenen weg', async () => {
    const aufbau = await aufbauen();

    const geteilt = aufbau.karte.ebenen.get('geteilteFunde');
    expect(geteilt?.features).toHaveLength(1);
    expect(geteilt?.features[0].properties?.['gerundet']).toBe(true);
  });

  it('nimmt eine Ebene weg, sobald der Ebenen-Knopf sie abschaltet', async () => {
    const aufbau = await aufbauen();

    aufbau.zustand.zeigeZonen.set(false);
    aufbau.zustand.zeigeMarker.set(false);
    aufbau.zustand.zeigeGeteilteFunde.set(false);
    aufbau.aktualisiere();

    expect(aufbau.karte.ebenen.has('zonen')).toBe(false);
    expect(aufbau.karte.ebenen.has('marker')).toBe(false);
    expect(aufbau.karte.ebenen.has('geteilteFunde')).toBe(false);
    expect(aufbau.karte.ebenen.has('funde')).toBe(true);
  });

  it('öffnet auf einen Tipp das Objekt-Blatt', async () => {
    const aufbau = await aufbauen();

    aufbau.karte.auswahl?.('funde', FUND.id);
    await vi.waitFor(() => {
      expect(aufbau.router.url).toContain(`objekt=fund:${FUND.id}`);
    });

    aufbau.karte.auswahl?.('marker', MARKER.id);
    await vi.waitFor(() => {
      expect(aufbau.router.url).toContain(`objekt=marker:${MARKER.id}`);
    });

    aufbau.karte.auswahl?.('zonen', ZONE.id);
    await vi.waitFor(() => {
      expect(aufbau.router.url).toContain(`objekt=zone:${ZONE.id}`);
    });
  });

  it('öffnet für einen fremden geteilten Fund kein Blatt', async () => {
    const aufbau = await aufbauen();

    aufbau.karte.auswahl?.('geteilteFunde', GETEILTER_FUND.id);

    expect(aufbau.router.url).not.toContain('objekt=');
  });
});
