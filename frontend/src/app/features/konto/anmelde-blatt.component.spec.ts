import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import { ManagerAttrappe, authAnbieter, oidcNutzer } from '../../testing/auth-attrappe';
import { keineVerstoesse } from '../../testing/axe';
import { AnmeldeBlattComponent } from './anmelde-blatt.component';

interface Aufbau {
  container: Element;
  auth: AuthService;
  manager: ManagerAttrappe;
  aktualisiere: () => void;
}

async function aufbauen(): Promise<Aufbau> {
  const manager = new ManagerAttrappe();
  const { container, detectChanges } = await render(AnmeldeBlattComponent, {
    providers: [provideRouter([]), ...authAnbieter(manager)],
  });
  return { container, auth: TestBed.inject(AuthService), manager, aktualisiere: detectChanges };
}

describe('AnmeldeBlattComponent', () => {
  it('bleibt geschlossen, solange nichts gespeichert werden soll', async () => {
    await aufbauen();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('zeigt die Texte des Artboards und führt zum SSO', async () => {
    const { auth, manager, aktualisiere, container } = await aufbauen();

    const frage = auth.anmeldungAnfordern();
    aktualisiere();

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Zum Speichern anmelden' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Funde, Marker und Zonen werden in deinem Konto bei beimgraben.net gespeichert. Die Karte ist auch ohne Anmeldung nutzbar.',
      ),
    ).toBeInTheDocument();
    await keineVerstoesse(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden mit beimgraben.net' }));

    expect(manager.umleitungen).toHaveLength(1);
    // Die Frage bleibt offen: die Seite verlässt die App zum SSO und kehrt
    // über /anmeldung zurück.
    expect(auth.blattOffen()).toBe(true);
    manager.rueckkehr = oidcNutzer();
    await auth.anmeldungAbschliessen();
    expect(await frage).toBe(true);
  });

  it('behält den Eintrag lokal, wenn später angemeldet wird', async () => {
    const { auth, aktualisiere } = await aufbauen();

    const frage = auth.anmeldungAnfordern();
    aktualisiere();
    await userEvent.click(screen.getByRole('button', { name: 'Später anmelden, Eintrag lokal behalten' }));

    expect(await frage).toBe(false);
    aktualisiere();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('legt den Fokus auf die Hauptaktion', async () => {
    const { auth, aktualisiere } = await aufbauen();

    void auth.anmeldungAnfordern();
    aktualisiere();

    expect(screen.getByRole('button', { name: 'Anmelden mit beimgraben.net' })).toHaveFocus();
  });
});
