import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import {
  MANIFEST_ROH,
  karteMitAttrappen,
  manifestAntwort,
  type ArbeiterAttrappe,
  type KartenAttrappe,
} from '../../testing/karte-attrappen';
import { ThemeService } from '../../core/theme/theme.service';
import { TestBed } from '@angular/core/testing';
import { KarteComponent } from './karte.component';

/** Die Seite hängt am Router; nur so trägt ihre Adresse die Abfragewerte. */
@Component({
  selector: 'app-wirt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class WirtComponent {}

@Component({
  selector: 'app-andere',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Arten</h1>',
})
class AndereComponent {}

const ROUTEN = [
  { path: 'karte', component: KarteComponent },
  { path: 'arten', component: AndereComponent },
];

async function karte(adresse = '/karte'): Promise<{
  attrappe: KartenAttrappe;
  arbeiter: ArbeiterAttrappe;
  stabil: () => Promise<void>;
}> {
  manifestAntwort();
  const { karte: attrappe, arbeiter } = karteMitAttrappen();
  const { fixture, navigate } = await render(WirtComponent, {
    providers: [provideRouter(ROUTEN)],
  });
  const stabil = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await navigate(adresse);
  await stabil();
  return { attrappe, arbeiter, stabil };
}

describe('KarteComponent', () => {
  it('zeigt Karte, Blattkopf, Zeitleiste und Legende', async () => {
    const { attrappe } = await karte();

    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('KW 40 · 2025')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Fundwahrscheinlichkeit je Begehung: 0 % – 50 %/ }),
    ).toBeInTheDocument();
    expect(attrappe.optionen?.stil).toContain('liberty');
    // MapLibre zählt für 512er-Kacheln: die 4 ist die Stufe 5 der Wertkacheln.
    expect(attrappe.optionen?.minZoom).toBe(4);
    expect(attrappe.optionen?.maxZoom).toBe(14);
  });

  it('nimmt ohne Angabe die jüngste gemessene Woche, nicht die Prognose', async () => {
    const { attrappe } = await karte();

    expect(attrappe.vorlagen.at(-1)).toBe('wert://boletus_edulis/boletus_edulis_kacheln/2025W40/{z}/{x}/{y}');
    expect(screen.queryByText('· Prognose')).not.toBeInTheDocument();
  });

  it('öffnet die Woche aus dem Deep Link und kennzeichnet eine Prognose', async () => {
    const { attrappe } = await karte('/karte?art=boletus_edulis&kw=2025-41');

    expect(screen.getByText('KW 41 · 2025')).toBeInTheDocument();
    expect(screen.getByText('· Prognose')).toBeInTheDocument();
    expect(attrappe.vorlagen.at(-1)).toContain('2025W41');
  });

  it('wechselt die Woche per Zeitleiste und schreibt sie in die Adresse', async () => {
    const { attrappe, stabil } = await karte();

    await userEvent.click(screen.getByRole('button', { name: 'KW 39 · 2025' }));
    await stabil();

    expect(attrappe.vorlagen.at(-1)).toContain('2025W39');
    expect(TestBed.inject(Router).url).toContain('kw=2025-39');
  });

  it('geht mit den Pfeilen eine Woche weiter und bleibt am Rand stehen', async () => {
    const { attrappe, stabil } = await karte('/karte?kw=2025-41');

    await userEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    await stabil();
    const nachRechts = attrappe.vorlagen.length;

    await userEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }));
    await stabil();

    expect(attrappe.vorlagen).toHaveLength(nachRechts + 1);
    expect(attrappe.vorlagen.at(-1)).toContain('2025W40');
  });

  it('spielt die Wochen im Takt und hält am Ende an', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { attrappe, stabil } = await karte('/karte?kw=2025-39');

      screen.getByRole('button', { name: 'Wochen abspielen' }).click();
      await vi.advanceTimersByTimeAsync(1500);
      await stabil();

      expect(attrappe.vorlagen.at(-1)).toContain('2025W41');

      await vi.advanceTimersByTimeAsync(1500);
      await stabil();

      expect(attrappe.vorlagen.at(-1)).toContain('2025W41');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lädt die Nachbarwochen der sichtbaren Kacheln vor', async () => {
    const { arbeiter } = await karte();
    const vorladen = arbeiter.auftraege.filter((auftrag) => auftrag.typ === 'vorladen');

    expect(vorladen).not.toHaveLength(0);
    const urls = vorladen[0].urls;
    expect(urls.some((url) => url.includes('2025W41'))).toBe(true);
    expect(urls.some((url) => url.includes('2025W39'))).toBe(true);
    expect(urls.every((url) => url.endsWith('.png'))).toBe(true);
  });

  it('rechnet die Karte auf den freien Streifen über dem Blatt', async () => {
    const { attrappe, stabil } = await karte();
    const vorher = attrappe.polster.length;

    await userEvent.click(screen.getByRole('button', { name: 'Blatt greifen' }));
    await stabil();

    expect(attrappe.eingepasst[0].polster.bottom).toBeGreaterThanOrEqual(0);
    expect(attrappe.polster.length).toBeGreaterThan(vorher);
  });

  it('folgt dem Theme mit dem Hintergrund', async () => {
    const { attrappe, stabil } = await karte();

    TestBed.inject(ThemeService).setWahl('dunkel');
    await stabil();

    expect(attrappe.stile.at(-1)).toContain('dark');
  });

  it('zeigt zu Ebene und Kombination noch keinen Inhalt', async () => {
    const { stabil } = await karte();

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stabil();

    expect(screen.getByText('Dieser Bereich kommt in einem späteren Arbeitspaket.')).toBeInTheDocument();
  });

  it('bleibt ohne Manifest bedienbar', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 404 } as Response));
    const { karte: attrappe } = karteMitAttrappen();
    const { fixture, container, navigate } = await render(WirtComponent, {
      providers: [provideRouter(ROUTEN)],
    });
    await navigate('/karte');
    await fixture.whenStable();

    expect(attrappe.vorlagen).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('räumt Karte und Worker beim Verlassen auf', async () => {
    manifestAntwort(MANIFEST_ROH);
    const { karte: attrappe, arbeiter } = karteMitAttrappen();
    const { fixture, navigate } = await render(WirtComponent, {
      providers: [provideRouter(ROUTEN)],
    });
    await navigate('/karte');
    await fixture.whenStable();

    fixture.destroy();

    expect(attrappe.zerstoert).toBe(true);
    expect(arbeiter.beendet).toBe(true);
  });
});
