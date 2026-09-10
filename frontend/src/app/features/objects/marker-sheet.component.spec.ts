import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { MARKER } from '../../testing/entries-fixture';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { MarkerSheetComponent } from './marker-sheet.component';

interface Setup {
  container: Element;
  locations: (readonly [number, number])[];
  closed: number;
  http: HttpTestingController;
  toasts: ToastSpy;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  const { container, detectChanges, fixture } = await render(MarkerSheetComponent, {
    inputs: { marker: MARKER },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const locations: (readonly [number, number])[] = [];
  let closed = 0;
  fixture.componentInstance.showOnMap.subscribe((location) => locations.push(location));
  fixture.componentInstance.closed.subscribe(() => (closed += 1));
  return {
    container,
    locations,
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpy(),
    refresh: detectChanges,
    get closed() {
      return closed;
    },
  };
}

describe('MarkerBlattComponent', () => {
  it('zeigt Name, Unterzeile, Farbe und Notiz', async () => {
    const setup = await build();

    expect(screen.getByRole('heading', { name: 'Alter Fichtenhang' })).toBeInTheDocument();
    expect(screen.getByText('Marker · privat')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Blau' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Notiz')).toHaveValue('Nordhang, ab Mitte September.');
    await noViolations(setup.container);
  });

  it('speichert eine Änderung', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('radio', { name: 'Rot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/marker/${MARKER.id}`));
    expect((request.request.body as { farbe: string }).farbe).toBe('rot');
    request.flush(MARKER);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Gespeichert.']);
    });
  });

  it('führt auf die Karte', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte anzeigen' }));

    expect(setup.locations).toEqual([[MARKER.lon, MARKER.lat]]);
  });

  it('löscht nach der Rückfrage und schließt', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Marker löschen' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/marker/${MARKER.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.closed).toBe(1);
    });
  });
});
