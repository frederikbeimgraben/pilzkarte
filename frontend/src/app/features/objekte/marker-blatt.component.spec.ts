import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { MARKER } from '../../testing/eintraege-fixture';
import { toastSpion, type ToastSpion } from '../../testing/toast-spion';
import { MarkerBlattComponent } from './marker-blatt.component';

interface Aufbau {
  container: Element;
  orte: (readonly [number, number])[];
  geschlossen: number;
  http: HttpTestingController;
  toasts: ToastSpion;
  aktualisiere: () => void;
}

async function aufbauen(): Promise<Aufbau> {
  const { container, detectChanges, fixture } = await render(MarkerBlattComponent, {
    inputs: { marker: MARKER },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const orte: (readonly [number, number])[] = [];
  let geschlossen = 0;
  fixture.componentInstance.zeigeAufKarte.subscribe((ort) => orte.push(ort));
  fixture.componentInstance.geschlossen.subscribe(() => (geschlossen += 1));
  return {
    container,
    orte,
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpion(),
    aktualisiere: detectChanges,
    get geschlossen() {
      return geschlossen;
    },
  };
}

describe('MarkerBlattComponent', () => {
  it('zeigt Name, Unterzeile, Farbe und Notiz', async () => {
    const aufbau = await aufbauen();

    expect(screen.getByRole('heading', { name: 'Alter Fichtenhang' })).toBeInTheDocument();
    expect(screen.getByText('Marker · privat')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Blau' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Notiz')).toHaveValue('Nordhang, ab Mitte September.');
    await keineVerstoesse(aufbau.container);
  });

  it('speichert eine Änderung', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('radio', { name: 'Rot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const anfrage = await vi.waitFor(() => aufbau.http.expectOne(`/api/marker/${MARKER.id}`));
    expect((anfrage.request.body as { farbe: string }).farbe).toBe('rot');
    anfrage.flush(MARKER);

    await vi.waitFor(() => {
      expect(aufbau.toasts.erfolg).toEqual(['Gespeichert.']);
    });
  });

  it('führt auf die Karte', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Auf der Karte anzeigen' }));

    expect(aufbau.orte).toEqual([[MARKER.lon, MARKER.lat]]);
  });

  it('löscht nach der Rückfrage und schließt', async () => {
    const aufbau = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: 'Marker löschen' }));
    aufbau.aktualisiere();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await vi.waitFor(() => {
      aufbau.http.expectOne(`/api/marker/${MARKER.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(aufbau.geschlossen).toBe(1);
    });
  });
});
