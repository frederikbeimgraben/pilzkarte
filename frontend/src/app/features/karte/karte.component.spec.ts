import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import {
  EBENEN_ROH,
  MANIFEST_ROH,
  karteMitAttrappen,
  manifestAntwort,
  type ArbeiterAttrappe,
  type KartenAttrappe,
} from '../../testing/karte-attrappen';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '@stupa-makers/ui-kit';
import { TestBed } from '@angular/core/testing';
import { AuthStummel, authStummelAnbieter } from '../../testing/auth-stummel';
import { toastSpion, type ToastSpion } from '../../testing/toast-spion';
import { EintragenZustand } from '../eintragen/eintragen.zustand';
import { KarteComponent } from './karte.component';
import { KartenZustand } from './karten-zustand';

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

/** Der Standort des Geräts, wie ihn der Test beantworten will. */
function standortStellen(antwort: (fertig: (stelle: unknown) => void, fehler: () => void) => void): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: antwort },
  });
}

const ROUTEN = [
  { path: 'karte', component: KarteComponent },
  { path: 'arten', component: AndereComponent },
];

async function karte(adresse = '/karte'): Promise<{
  attrappe: KartenAttrappe;
  arbeiter: ArbeiterAttrappe;
  stabil: () => Promise<void>;
  container: HTMLElement;
}> {
  manifestAntwort();
  const { karte: attrappe, arbeiter } = karteMitAttrappen();
  const { fixture, navigate, container } = await render(WirtComponent, {
    providers: [
      provideRouter(ROUTEN),
      provideHttpClient(),
      provideHttpClientTesting(),
      ...authStummelAnbieter(new AuthStummel()),
    ],
  });
  const stabil = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  await navigate(adresse);
  await stabil();
  return { attrappe, arbeiter, stabil, container };
}

/** jsdom kennt keine Ortung; der Test setzt sie am Navigator ein. */
function setzeOrtung(ortung: Partial<Geolocation>): void {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: ortung });
}

describe('KarteComponent', () => {
  it('zeigt Karte, Blattkopf, Zeitleiste und Legende', async () => {
    const { attrappe, container } = await karte();

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
    await keineVerstoesse(container);
  });

  it('nimmt ohne Angabe die jüngste gemessene Woche, nicht die Prognose', async () => {
    const { attrappe } = await karte();

    expect(attrappe.vorlagen().at(-1)).toBe(
      'wert://boletus_edulis/boletus_edulis_kacheln/2025W40/{z}/{x}/{y}',
    );
    expect(screen.queryByText('· Prognose')).not.toBeInTheDocument();
  });

  it('öffnet die Woche aus dem Deep Link und kennzeichnet eine Prognose', async () => {
    const { attrappe } = await karte('/karte?art=boletus_edulis&kw=2025-41');

    expect(screen.getByText('KW 41 · 2025')).toBeInTheDocument();
    expect(screen.getByText('· Prognose')).toBeInTheDocument();
    expect(attrappe.vorlagen().at(-1)).toContain('2025W41');
  });

  it('wechselt die Woche per Zeitleiste und schreibt sie in die Adresse', async () => {
    const { attrappe, stabil } = await karte();

    await userEvent.click(screen.getByRole('button', { name: 'KW 39 · 2025' }));
    await stabil();

    expect(attrappe.vorlagen().at(-1)).toContain('2025W39');
    expect(TestBed.inject(Router).url).toContain('kw=2025-39');
  });

  it('geht mit den Pfeilen eine Woche weiter und bleibt am Rand stehen', async () => {
    const { attrappe, stabil } = await karte('/karte?kw=2025-41');

    await userEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    await stabil();
    const nachRechts = attrappe.vorlagen().length;

    await userEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }));
    await stabil();

    expect(attrappe.vorlagen()).toHaveLength(nachRechts + 1);
    expect(attrappe.vorlagen().at(-1)).toContain('2025W40');
  });

  it('spielt die Wochen im Takt und hält am Ende an', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { attrappe, stabil } = await karte('/karte?kw=2025-39');

      screen.getByRole('button', { name: 'Wochen abspielen' }).click();
      await vi.advanceTimersByTimeAsync(1500);
      await stabil();

      expect(attrappe.vorlagen().at(-1)).toContain('2025W41');

      await vi.advanceTimersByTimeAsync(1500);
      await stabil();

      expect(attrappe.vorlagen().at(-1)).toContain('2025W41');
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

  it('zeigt die Kombination mit ihren vier Faktoren', async () => {
    const { container, stabil } = await karte('/karte?darstellung=kombination');
    await stabil();

    expect(screen.getByRole('button', { name: 'Kombination' })).toBeInTheDocument();
    const faktoren = screen.getByRole('group', { name: 'Faktoren' });
    expect(faktoren).toHaveTextContent('Niederschlag der letzten 4 Wochen');
    expect(faktoren).toHaveTextContent('≥ 80 mm');
    expect(faktoren).toHaveTextContent('8 bis 16 Grad');
    expect(screen.getByText(/Wochenbezogene Faktoren beziehen sich auf KW 40 · 2025/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(screen.getByText('Speichern kommt mit dem Konto.')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('legt die Kombination als eine Quelle auf die Karte', async () => {
    const { attrappe, stabil } = await karte('/karte?darstellung=kombination');
    await stabil();

    expect(attrappe.vorlagen('ebene').at(-1)).toMatch(/^wert:\/\/kombi\/[0-9a-f]{8}\//);
    expect(attrappe.vorlagenJeRolle.get('vorhersage')?.at(-1)).toBeNull();
  });

  it('wechselt die Regel und zeigt dann eine Rampe', async () => {
    const { attrappe, stabil } = await karte('/karte?darstellung=kombination');
    await stabil();
    const vorher = attrappe.vorlagen('ebene').at(-1);

    await userEvent.click(screen.getByRole('tab', { name: 'Abgestuft' }));
    await stabil();

    expect(TestBed.inject(Router).url).toContain('regel=abgestuft');
    expect(attrappe.vorlagen('ebene').at(-1)).not.toBe(vorher);
    expect(screen.getByRole('img', { name: /Erfüllung der Bedingungen/ })).toBeInTheDocument();
  });

  it('hakt einen Faktor ab und schreibt ihn so in die Adresse', async () => {
    const { stabil } = await karte('/karte?darstellung=kombination');
    await stabil();

    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    await stabil();

    expect(TestBed.inject(Router).url).toContain('!regen_4w');
  });

  it('öffnet den Faktor-Screen und zeigt dabei die Ebene selbst', async () => {
    const { attrappe, container, stabil } = await karte('/karte?darstellung=kombination');
    await stabil();

    await userEvent.click(screen.getByRole('button', { name: '≥ 80 mm' }));
    await stabil();

    expect(screen.getByRole('dialog', { name: 'Faktor' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Verteilung über Deutschland/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Die Bedingung ist auf \d+ % der Fläche Deutschlands erfüllt\./),
    ).toBeInTheDocument();
    expect(attrappe.vorlagen('ebene').at(-1)).toContain('ebene-regen_4w');
    await keineVerstoesse(container);
  });

  it('übernimmt eine geänderte Bedingung', async () => {
    const { stabil } = await karte('/karte?darstellung=kombination');
    await stabil();
    await userEvent.click(screen.getByRole('button', { name: '≥ 80 mm' }));
    await stabil();

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '40' } });
    await stabil();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await stabil();

    expect(TestBed.inject(Router).url).toContain('regen_4w:ge:40');
    expect(screen.getByRole('group', { name: 'Faktoren' })).toHaveTextContent('≥ 40 mm');
  });

  it('entfernt einen Faktor', async () => {
    const { stabil } = await karte('/karte?darstellung=kombination');
    await stabil();
    await userEvent.click(screen.getByRole('button', { name: '≥ 80 mm' }));
    await stabil();

    await userEvent.click(screen.getByRole('button', { name: 'Faktor entfernen' }));
    await stabil();

    expect(TestBed.inject(Router).url).not.toContain('regen_4w');
    expect(screen.getByRole('group', { name: 'Faktoren' })).not.toHaveTextContent('Niederschlag');
  });

  it('bietet zum Hinzufügen die Ebenen und die Arten an', async () => {
    const { stabil } = await karte('/karte?darstellung=kombination');
    await stabil();

    await userEvent.click(screen.getByRole('button', { name: 'Faktor hinzufügen' }));
    await stabil();

    const liste = screen.getByRole('group', { name: 'Faktor hinzufügen' });
    expect(liste).toHaveTextContent('Arten');
    expect(liste).toHaveTextContent('Steinpilz');
    expect(screen.getAllByText('schon dabei').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Boden-pH/ }));
    await stabil();

    expect(screen.getByRole('dialog', { name: 'Faktor' })).toBeInTheDocument();
    expect(TestBed.inject(Router).url).toContain('boden_ph');
  });

  it('bleibt ohne Manifest bedienbar', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 404 } as Response));
    const { karte: attrappe } = karteMitAttrappen();
    const { fixture, container, navigate } = await render(WirtComponent, {
      providers: [provideRouter(ROUTEN)],
    });
    await navigate('/karte');
    await fixture.whenStable();

    expect(attrappe.vorlagen()).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('öffnet mit dem Plus-Knopf das Aktionsblatt', async () => {
    const { stabil } = await karte();

    await userEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    await stabil();

    expect(TestBed.inject(EintragenZustand).schritt()).toBe('aktionen');
    expect(screen.getByRole('heading', { name: 'Eintragen' })).toBeInTheDocument();
  });

  it('zentriert die Karte auf den eigenen Standort', async () => {
    const { attrappe } = await karte();
    standortStellen((fertig) => {
      fertig({ coords: { longitude: 9.1, latitude: 48.6 } });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Standort' }));

    expect(attrappe.fluege[0].ziel).toEqual([9.1, 48.6]);
  });

  it('sagt es, wenn der Standort nicht zu haben ist', async () => {
    await karte();
    const toasts: ToastSpion = toastSpion();
    standortStellen((_fertig, fehler) => {
      fehler();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Standort' }));

    expect(toasts.fehler).toEqual(['Der Standort ist gerade nicht zu haben.']);
  });

  it('holt die geteilten Funde des Ausschnitts', async () => {
    await karte();
    const http = TestBed.inject(HttpTestingController);

    await vi.waitFor(() => http.expectOne('/api/funde/geteilt?bbox=9.9,50.9,10.9,51.9&limit=200'));
  });

  it('rechnet das Polster auf ein Blatt, das über der Karte liegt', async () => {
    const { attrappe, stabil } = await karte();
    TestBed.inject(KartenZustand).ueberlagerung.set(240);
    await stabil();

    expect(attrappe.polster.at(-1)).toEqual({ top: 0, bottom: 240, left: 0, right: 0 });
  });

  it('räumt Karte und Worker beim Verlassen auf', async () => {
    manifestAntwort(MANIFEST_ROH);
    const { karte: attrappe, arbeiter } = karteMitAttrappen();
    const { fixture, navigate } = await render(WirtComponent, {
      providers: [
        provideRouter(ROUTEN),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...authStummelAnbieter(new AuthStummel()),
      ],
    });
    await navigate('/karte');
    await fixture.whenStable();

    fixture.destroy();

    expect(attrappe.zerstoert).toBe(true);
    expect(arbeiter.beendet).toBe(true);
  });

  it('zeigt die Ebenen in zwei Gruppen mit ihrer Einheit', async () => {
    const { container, stabil } = await karte();

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stabil();

    expect(screen.getByText('Je Woche')).toBeInTheDocument();
    expect(screen.getByText('Fest')).toBeInTheDocument();
    const liste = screen.getByRole('group', { name: 'Eingabe-Ebenen' });
    expect(liste).toHaveTextContent('Niederschlag der letzten 4 Wochen');
    expect(liste).toHaveTextContent('mm');
    expect(liste).toHaveTextContent('Waldanteil');
    await keineVerstoesse(container);
  });

  it('legt die gewählte Ebene über die Karte und nennt Rampe und Einheit', async () => {
    const { attrappe, stabil } = await karte();

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stabil();

    expect(attrappe.vorlagen('ebene').at(-1)).toBe(
      'wert://ebene-regen_4w/layers_kacheln/regen_4w/2025W40/{z}/{x}/{y}',
    );
    expect(
      screen.getByRole('img', {
        name: /Niederschlag der letzten 4 Wochen: 0 mm – 152 mm/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Niederschlag der letzten 4 Wochen/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('wechselt die Ebene und schreibt sie in die Adresse', async () => {
    const { attrappe, stabil } = await karte();
    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stabil();

    await userEvent.click(screen.getByRole('button', { name: /Boden-pH/ }));
    await stabil();

    expect(attrappe.vorlagen('ebene').at(-1)).toBe(
      'wert://ebene-boden_ph/layers_kacheln/boden_ph/{z}/{x}/{y}',
    );
    expect(TestBed.inject(Router).url).toContain('ebene=boden_ph');
    expect(screen.getByRole('img', { name: /Boden-pH: 4,7 – 6,9/ })).toBeInTheDocument();
  });

  it('dämpft die Zeitleiste bei einer festen Ebene und sagt warum', async () => {
    const { container, stabil } = await karte();
    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stabil();

    await userEvent.click(screen.getByRole('button', { name: /Waldanteil/ }));
    await stabil();

    expect(screen.getByText('Diese Ebene gilt für alle Wochen.')).toBeInTheDocument();
    expect(container.querySelector('.leiste--gedaempft')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'KW 40 · 2025' })).toBeDisabled();
  });

  it('sagt, wenn die Ebene nicht so weit reicht wie die Zeitleiste', async () => {
    const { stabil } = await karte('/karte?darstellung=ebene&kw=2025-41');
    await stabil();

    expect(
      screen.getByText('Die Ebene zeigt KW 40 · 2025; weiter reicht das Wetter nicht.'),
    ).toBeInTheDocument();
  });

  it('öffnet den Deep Link mit Darstellung, Ebene und Deckkraft', async () => {
    const { attrappe, stabil } = await karte(
      '/karte?darstellung=ebene&ebene=temperatur&kw=2025-40&deckkraft=70',
    );
    await stabil();

    expect(attrappe.vorlagen('ebene').at(-1)).toContain('ebene-temperatur');
    expect(attrappe.deckkraft.get('ebene')).toBeCloseTo(0.7);
    expect(attrappe.deckkraft.get('vorhersage')).toBe(1);
    expect(
      screen.getByRole('img', { name: /Mitteltemperatur der Woche: -3,6 Grad – 24,7 Grad/ }),
    ).toBeInTheDocument();
  });

  it('nimmt die Vorhersage weg, solange nur die Ebene gefragt ist', async () => {
    const { attrappe, stabil } = await karte();
    const vorher = attrappe.vorlagen().length;

    await userEvent.click(screen.getByRole('tab', { name: 'Ebene' }));
    await stabil();

    expect(attrappe.vorlagenJeRolle.get('vorhersage')?.at(-1)).toBeNull();
    expect(vorher).toBeGreaterThan(0);
  });

  it('legt die Vorhersage auf Wunsch unter die Ebene', async () => {
    const { attrappe, stabil } = await karte('/karte?darstellung=ebene');
    await stabil();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte' }));
    await stabil();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Vorhersage darunter zeigen' }));
    await stabil();

    expect(attrappe.vorlagenJeRolle.get('vorhersage')?.at(-1)).toContain('boletus_edulis');
  });

  it('stellt Hintergrund und Deckkraft über den Ebenen-Knopf', async () => {
    const { attrappe, stabil } = await karte();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte' }));
    await stabil();

    expect(screen.getAllByText('kommt später')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Dunkel' }));
    await stabil();

    expect(attrappe.stile.at(-1)).toContain('dark');

    const regler = screen.getByRole('slider', { name: 'Deckkraft der Wertebene' });
    fireEvent.input(regler, { target: { value: '40' } });
    await stabil();

    expect(attrappe.deckkraft.get('vorhersage')).toBeCloseTo(0.4);
    expect(TestBed.inject(Router).url).toContain('deckkraft=40');
  });

  it('zentriert auf den Standort und meldet einen Fehlschlag', async () => {
    const { attrappe, stabil } = await karte();
    const holen = vi.fn((erfolg: PositionCallback) => {
      erfolg({ coords: { longitude: 9.1, latitude: 48.8 } } as GeolocationPosition);
    });
    setzeOrtung({ getCurrentPosition: holen });

    await userEvent.click(screen.getByRole('button', { name: 'Auf meinen Standort' }));
    await stabil();

    expect(attrappe.zentriert?.punkt).toEqual([9.1, 48.8]);

    setzeOrtung({
      getCurrentPosition: (_erfolg: PositionCallback, fehler: PositionErrorCallback) => {
        fehler({ code: 1 } as GeolocationPositionError);
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Auf meinen Standort' }));
    await stabil();

    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toContain('Kein Standort');
  });

  it('behält die Ebene aus dem Deep Link, auch wenn `layers.json` später kommt', async () => {
    vi.stubGlobal('fetch', (pfad: string) =>
      pfad === '/layers.json'
        ? new Promise<Response>((fertig) => {
            setTimeout(() => {
              fertig({ ok: true, status: 200, json: () => Promise.resolve(EBENEN_ROH) } as Response);
            }, 20);
          })
        : Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(MANIFEST_ROH),
          } as Response),
    );
    const { karte: attrappe } = karteMitAttrappen();
    const { fixture, navigate } = await render(WirtComponent, { providers: [provideRouter(ROUTEN)] });

    await navigate('/karte?darstellung=ebene&ebene=temperatur');
    await new Promise((fertig) => setTimeout(fertig, 60));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toContain('ebene=temperatur');
    expect(attrappe.vorlagen('ebene').at(-1)).toContain('ebene-temperatur');
  });
});
