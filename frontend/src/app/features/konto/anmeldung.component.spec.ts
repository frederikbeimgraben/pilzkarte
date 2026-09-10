import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ManagerAttrappe, authAnbieter, oidcNutzer } from '../../testing/auth-attrappe';
import { AnmeldungComponent } from './anmeldung.component';
import { StilleAnmeldungComponent } from './stille-anmeldung.component';

interface Aufbau {
  router: Router;
  manager: ManagerAttrappe;
  aktualisiere: () => void;
}

async function aufbauen(manager: ManagerAttrappe): Promise<Aufbau> {
  const { detectChanges, fixture } = await render(AnmeldungComponent, {
    providers: [provideRouter([{ path: '**', children: [] }]), ...authAnbieter(manager)],
  });
  await fixture.whenStable();
  detectChanges();
  return { router: TestBed.inject(Router), manager, aktualisiere: detectChanges };
}

describe('AnmeldungComponent', () => {
  it('führt nach dem Tausch auf die gemerkte Route zurück', async () => {
    const manager = new ManagerAttrappe();
    manager.rueckkehr = oidcNutzer({ zustand: { zurueck: '/eintraege' } });

    const { router } = await aufbauen(manager);

    expect(router.url).toBe('/eintraege');
  });

  it('sagt es, wenn der Tausch scheitert, und lässt den Weg zur Karte offen', async () => {
    const manager = new ManagerAttrappe();
    manager.rueckkehr = new Error('Code schon eingelöst');

    const { router } = await aufbauen(manager);
    const wechsel = vi.spyOn(router, 'navigateByUrl');

    expect(
      screen.getByText('Die Anmeldung ist fehlgeschlagen. Versuche es noch einmal.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Karte' }));
    expect(wechsel).toHaveBeenCalledWith('/karte');
  });
});

describe('StilleAnmeldungComponent', () => {
  it('meldet das Ergebnis an das Fenster darüber und zeigt nichts', async () => {
    const manager = new ManagerAttrappe();
    const { container, fixture } = await render(StilleAnmeldungComponent, {
      providers: [provideRouter([]), ...authAnbieter(manager)],
    });
    await fixture.whenStable();

    expect(manager.stilleCallbacks).toBe(1);
    expect(container).toBeEmptyDOMElement();
  });
});
