import { provideHttpClient } from '@angular/common/http';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { AuthStummel, authStummelAnbieter } from '../../testing/auth-stummel';
import { keineVerstoesse } from '../../testing/axe';
import { FUND } from '../../testing/eintraege-fixture';
import { MANIFEST_ROH, wertKachelAntwort } from '../../testing/karte-attrappen';
import { toastSpion, type ToastSpion } from '../../testing/toast-spion';
import { FundBlattComponent } from './fund-blatt.component';

/** Karte, Konto und Katalog stehen für jeden Test dieses Blatts gleich. */
function anbieter(): (EnvironmentProviders | Provider)[] {
  return [provideHttpClient(), provideHttpClientTesting(), ...authStummelAnbieter(new AuthStummel())];
}

/** Die Kachel, in der der Fund der Vorlage liegt: Zoom 7, Spalte 67, Zeile 44. */
const MANIFEST = { ...MANIFEST_ROH, tiles: { zooms: [7, 7], have: { '7': ['67/44'] } } };

/**
 * Manifest und Wertkachel ohne Netz. Das Manifest kommt als JSON, die Kachel
 * als Bild; beide gehen über `fetch`, nicht über die API.
 */
function kartenAntworten(byte: number, manifest: unknown = MANIFEST): void {
  wertKachelAntwort(byte);
  vi.stubGlobal('fetch', (url: string) =>
    url.endsWith('.png')
      ? Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) })
      : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) }),
  );
}

interface Aufbau {
  container: Element;
  orte: (readonly [number, number])[];
  geschlossen: number;
  toasts: ToastSpion;
  http: HttpTestingController;
  aktualisiere: () => void;
}

async function aufbauen(): Promise<Aufbau> {
  const { container, detectChanges, fixture } = await render(FundBlattComponent, {
    inputs: { fund: FUND },
    providers: anbieter(),
  });
  const http = TestBed.inject(HttpTestingController);
  http.match('/api/arten').forEach((anfrage) => {
    anfrage.flush(ARTEN_LISTE);
  });
  detectChanges();
  const orte: (readonly [number, number])[] = [];
  let geschlossen = 0;
  fixture.componentInstance.zeigeAufKarte.subscribe((ort) => orte.push(ort));
  fixture.componentInstance.geschlossen.subscribe(() => (geschlossen += 1));
  return {
    container,
    orte,
    toasts: toastSpion(),
    http,
    aktualisiere: detectChanges,
    get geschlossen() {
      return geschlossen;
    },
  };
}

describe('FundBlattComponent', () => {
  beforeEach(() => {
    // Byte 108 sind (108 - 1) / 254 × 0,5, also 21 % je Begehung.
    kartenAntworten(108);
  });

  it('zeigt Art, Datum, Anzahl, Melder und das Kennzeichen geteilt', async () => {
    const aufbau = await aufbauen();

    expect(screen.getByRole('heading', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('6. September 2026 · 3 Stück · Frederik')).toBeInTheDocument();
    expect(screen.getByText('Geteilt')).toBeInTheDocument();
    expect(screen.getByText(FUND.notiz ?? '')).toBeInTheDocument();
    await keineVerstoesse(aufbau.container);
  });

  it('nennt die Vorhersage an diesem Ort mit Art, Woche und Bezug', async () => {
    const aufbau = await aufbauen();

    await vi.waitFor(() => {
      aufbau.aktualisiere();
      expect(screen.getByText('Vorhersage an diesem Ort')).toBeInTheDocument();
    });
    expect(screen.getByText('Steinpilz, KW 40 · 2025, je Begehung')).toBeInTheDocument();
    expect(screen.getByText('21 %')).toBeInTheDocument();
  });

  it('lässt die Kennzahl weg, wenn es für den Ort keine gibt', async () => {
    kartenAntworten(0);
    const aufbau = await aufbauen();

    await vi.waitFor(() => {
      aufbau.aktualisiere();
    });

    expect(screen.queryByText('Vorhersage an diesem Ort')).not.toBeInTheDocument();
  });

  it('zeigt den Fund ohne Anzahl in der kurzen Zeile', async () => {
    await render(FundBlattComponent, {
      inputs: { fund: { ...FUND, anzahl: null } },
      providers: anbieter(),
    });
    TestBed.inject(HttpTestingController)
      .match('/api/arten')
      .forEach((anfrage) => {
        anfrage.flush(ARTEN_LISTE);
      });

    expect(screen.getByText('6. September 2026 · Frederik')).toBeInTheDocument();
  });

  it('führt auf die Karte', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: /Auf der Karte anzeigen/ }));

    expect(aufbau.orte).toEqual([[FUND.lon, FUND.lat]]);
  });

  it('speichert eine Änderung und kehrt zur Ansicht zurück', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    aufbau.aktualisiere();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      aufbau.http.expectOne(`/api/funde/${FUND.id}`).flush(FUND);
    });

    await vi.waitFor(() => {
      aufbau.aktualisiere();
      expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    });
    expect(aufbau.toasts.erfolg).toEqual(['Gespeichert.']);
  });

  it('bleibt im Formular, wenn die Änderung nicht durchgeht', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    aufbau.aktualisiere();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      aufbau.http.expectOne(`/api/funde/${FUND.id}`).error(new ProgressEvent('error'));
    });

    await vi.waitFor(() => {
      aufbau.aktualisiere();
    });
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
  });

  it('fragt vor dem Löschen und schließt danach', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    aufbau.aktualisiere();
    expect(
      screen.getByText('Der Fund und seine Fotos werden entfernt. Das lässt sich nicht rückgängig machen.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    await vi.waitFor(() => {
      aufbau.http.expectOne(`/api/funde/${FUND.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(aufbau.geschlossen).toBe(1);
    });
    expect(aufbau.toasts.erfolg).toEqual(['Der Fund ist gelöscht.']);
  });

  it('schließt die Rückfrage, ohne zu löschen', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    aufbau.aktualisiere();
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    aufbau.aktualisiere();

    aufbau.http.expectNone(`/api/funde/${FUND.id}`);
    expect(aufbau.geschlossen).toBe(0);
  });

  it('lässt die Kennzahl weg, wenn die Art keine Vorhersagekarte hat', async () => {
    const { detectChanges } = await render(FundBlattComponent, {
      inputs: { fund: { ...FUND, artSlug: 'speisemorchel' } },
      providers: anbieter(),
    });
    TestBed.inject(HttpTestingController)
      .match('/api/arten')
      .forEach((anfrage) => {
        anfrage.flush(ARTEN_LISTE);
      });
    detectChanges();

    expect(screen.queryByText('Vorhersage an diesem Ort')).not.toBeInTheDocument();
  });

  it('lässt die Kennzahl weg, wenn das Manifest nicht kommt', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const { detectChanges } = await render(FundBlattComponent, {
      inputs: { fund: FUND },
      providers: anbieter(),
    });
    TestBed.inject(HttpTestingController)
      .match('/api/arten')
      .forEach((anfrage) => {
        anfrage.flush(ARTEN_LISTE);
      });
    await vi.waitFor(() => {
      detectChanges();
    });

    expect(screen.queryByText('Vorhersage an diesem Ort')).not.toBeInTheDocument();
  });
});
