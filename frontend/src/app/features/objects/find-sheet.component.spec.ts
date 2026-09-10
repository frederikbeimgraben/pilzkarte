import { provideHttpClient } from '@angular/common/http';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND } from '../../testing/entries-fixture';
import { RAW_MANIFEST, answerValueTile } from '../../testing/map-doubles';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { FindSheetComponent } from './find-sheet.component';

/** Karte, Konto und Katalog stehen für jeden Test dieses Blatts gleich. */
function provider(): (EnvironmentProviders | Provider)[] {
  return [provideHttpClient(), provideHttpClientTesting(), ...authStubProviders(new AuthStub())];
}

/** Die Kachel, in der der Fund der Vorlage liegt: Zoom 7, Spalte 67, Zeile 44. */
const MANIFEST = { ...RAW_MANIFEST, tiles: { zooms: [7, 7], have: { '7': ['67/44'] } } };

/**
 * Manifest und Wertkachel ohne Netz. Das Manifest kommt als JSON, die Kachel
 * als Bild; beide gehen über `fetch`, nicht über die API.
 */
function answerMap(byte: number, manifest: unknown = MANIFEST): void {
  answerValueTile(byte);
  vi.stubGlobal('fetch', (url: string) =>
    url.endsWith('.png')
      ? Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) })
      : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) }),
  );
}

interface Setup {
  container: Element;
  locations: (readonly [number, number])[];
  closed: number;
  toasts: ToastSpy;
  http: HttpTestingController;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  const { container, detectChanges, fixture } = await render(FindSheetComponent, {
    inputs: { find: FIND },
    providers: provider(),
  });
  const http = TestBed.inject(HttpTestingController);
  http.match('/api/arten').forEach((request) => {
    request.flush(SPECIES_LIST);
  });
  detectChanges();
  const locations: (readonly [number, number])[] = [];
  let closed = 0;
  fixture.componentInstance.showOnMap.subscribe((location) => locations.push(location));
  fixture.componentInstance.closed.subscribe(() => (closed += 1));
  return {
    container,
    locations,
    toasts: toastSpy(),
    http,
    refresh: detectChanges,
    get closed() {
      return closed;
    },
  };
}

describe('FundBlattComponent', () => {
  beforeEach(() => {
    // Byte 108 sind (108 - 1) / 254 × 0,5, also 21 % je Begehung.
    answerMap(108);
  });

  it('zeigt Art, Datum, Anzahl, Melder und das Kennzeichen geteilt', async () => {
    const setup = await build();

    expect(screen.getByRole('heading', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('6. September 2026 · 3 Stück · Frederik')).toBeInTheDocument();
    expect(screen.getByText('Geteilt')).toBeInTheDocument();
    expect(screen.getByText(FIND.notiz ?? '')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('nennt die Vorhersage an diesem Ort mit Art, Woche und Bezug', async () => {
    const setup = await build();

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText('Vorhersage an diesem Ort')).toBeInTheDocument();
    });
    expect(screen.getByText('Steinpilz, KW 40 · 2025, je Begehung')).toBeInTheDocument();
    expect(screen.getByText('21 %')).toBeInTheDocument();
  });

  it('lässt die Kennzahl weg, wenn es für den Ort keine gibt', async () => {
    answerMap(0);
    const setup = await build();

    await vi.waitFor(() => {
      setup.refresh();
    });

    expect(screen.queryByText('Vorhersage an diesem Ort')).not.toBeInTheDocument();
  });

  it('zeigt den Fund ohne Anzahl in der kurzen Zeile', async () => {
    await render(FindSheetComponent, {
      inputs: { find: { ...FIND, anzahl: null } },
      providers: provider(),
    });
    TestBed.inject(HttpTestingController)
      .match('/api/arten')
      .forEach((request) => {
        request.flush(SPECIES_LIST);
      });

    expect(screen.getByText('6. September 2026 · Frederik')).toBeInTheDocument();
  });

  it('führt auf die Karte', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: /Auf der Karte anzeigen/ }));

    expect(setup.locations).toEqual([[FIND.lon, FIND.lat]]);
  });

  it('speichert eine Änderung und kehrt zur Ansicht zurück', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/funde/${FIND.id}`).flush(FIND);
    });

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
    });
    expect(setup.toasts.success).toEqual(['Gespeichert.']);
  });

  it('bleibt im Formular, wenn die Änderung nicht durchgeht', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/funde/${FIND.id}`).error(new ProgressEvent('error'));
    });

    await vi.waitFor(() => {
      setup.refresh();
    });
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
  });

  it('fragt vor dem Löschen und schließt danach', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    expect(
      screen.getByText('Der Fund und seine Fotos werden entfernt. Das lässt sich nicht rückgängig machen.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/funde/${FIND.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.closed).toBe(1);
    });
    expect(setup.toasts.success).toEqual(['Der Fund ist gelöscht.']);
  });

  it('schließt die Rückfrage, ohne zu löschen', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    setup.refresh();

    setup.http.expectNone(`/api/funde/${FIND.id}`);
    expect(setup.closed).toBe(0);
  });

  it('lässt die Kennzahl weg, wenn die Art keine Vorhersagekarte hat', async () => {
    const { detectChanges } = await render(FindSheetComponent, {
      inputs: { find: { ...FIND, artSlug: 'speisemorchel' } },
      providers: provider(),
    });
    TestBed.inject(HttpTestingController)
      .match('/api/arten')
      .forEach((request) => {
        request.flush(SPECIES_LIST);
      });
    detectChanges();

    expect(screen.queryByText('Vorhersage an diesem Ort')).not.toBeInTheDocument();
  });

  it('lässt die Kennzahl weg, wenn das Manifest nicht kommt', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const { detectChanges } = await render(FindSheetComponent, {
      inputs: { find: FIND },
      providers: provider(),
    });
    TestBed.inject(HttpTestingController)
      .match('/api/arten')
      .forEach((request) => {
        request.flush(SPECIES_LIST);
      });
    await vi.waitFor(() => {
      detectChanges();
    });

    expect(screen.queryByText('Vorhersage an diesem Ort')).not.toBeInTheDocument();
  });
});
