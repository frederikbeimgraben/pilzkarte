import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import { ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { noViolations } from '../../testing/axe';
import { SignInSheetComponent } from './signin-sheet.component';

interface Setup {
  container: Element;
  auth: AuthService;
  manager: ManagerDouble;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  const manager = new ManagerDouble();
  const { container, detectChanges } = await render(SignInSheetComponent, {
    providers: [provideRouter([]), ...authProvider(manager)],
  });
  return { container, auth: TestBed.inject(AuthService), manager, refresh: detectChanges };
}

describe('AnmeldeBlattComponent', () => {
  it('bleibt geschlossen, solange nichts gespeichert werden soll', async () => {
    await build();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('zeigt die Texte des Artboards und führt zum SSO', async () => {
    const { auth, manager, refresh, container } = await build();

    const ask = auth.requestSignIn();
    refresh();

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Zum Speichern anmelden' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Funde, Marker und Zonen werden in deinem Konto bei beimgraben.net gespeichert. Die Karte ist auch ohne Anmeldung nutzbar.',
      ),
    ).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden mit beimgraben.net' }));

    expect(manager.redirects).toHaveLength(1);
    // Die Frage bleibt offen: die Seite verlässt die App zum SSO und kehrt
    // über /anmeldung zurück.
    expect(auth.sheetOpen()).toBe(true);
    manager.returnValue = oidcUser();
    await auth.completeSignIn();
    expect(await ask).toBe(true);
  });

  it('behält den Eintrag lokal, wenn später angemeldet wird', async () => {
    const { auth, refresh } = await build();

    const ask = auth.requestSignIn();
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Später anmelden, Eintrag lokal behalten' }));

    expect(await ask).toBe(false);
    refresh();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('legt den Fokus auf die Hauptaktion', async () => {
    const { auth, refresh } = await build();

    void auth.requestSignIn();
    refresh();

    expect(screen.getByRole('button', { name: 'Anmelden mit beimgraben.net' })).toHaveFocus();
  });
});
