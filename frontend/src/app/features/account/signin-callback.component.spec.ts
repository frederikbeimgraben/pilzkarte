import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { SignInCallbackComponent } from './signin-callback.component';
import { SilentSignInComponent } from './silent-signin.component';

interface Setup {
  router: Router;
  manager: ManagerDouble;
  refresh: () => void;
}

async function build(manager: ManagerDouble): Promise<Setup> {
  const { detectChanges, fixture } = await render(SignInCallbackComponent, {
    providers: [provideRouter([{ path: '**', children: [] }]), ...authProvider(manager)],
  });
  await fixture.whenStable();
  detectChanges();
  return { router: TestBed.inject(Router), manager, refresh: detectChanges };
}

describe('AnmeldungComponent', () => {
  it('führt nach dem Tausch auf die gemerkte Route zurück', async () => {
    const manager = new ManagerDouble();
    manager.returnValue = oidcUser({ state: { back: '/eintraege' } });

    const { router } = await build(manager);

    expect(router.url).toBe('/eintraege');
  });

  it('sagt es, wenn der Tausch scheitert, und lässt den Weg zur Karte offen', async () => {
    const manager = new ManagerDouble();
    manager.returnValue = new Error('Code schon eingelöst');

    const { router } = await build(manager);
    const change = vi.spyOn(router, 'navigateByUrl');

    expect(
      screen.getByText('Die Anmeldung ist fehlgeschlagen. Versuche es noch einmal.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Karte' }));
    expect(change).toHaveBeenCalledWith('/karte');
  });
});

describe('StilleAnmeldungComponent', () => {
  it('meldet das Ergebnis an das Fenster darüber und zeigt nichts', async () => {
    const manager = new ManagerDouble();
    const { container, fixture } = await render(SilentSignInComponent, {
      providers: [provideRouter([]), ...authProvider(manager)],
    });
    await fixture.whenStable();

    expect(manager.silentCallbacks).toBe(1);
    expect(container).toBeEmptyDOMElement();
  });
});
