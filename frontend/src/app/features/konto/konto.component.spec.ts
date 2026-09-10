import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import { ThemeService } from '../../core/theme/theme.service';
import { KONFIGURATION, ManagerAttrappe, authAnbieter, oidcNutzer } from '../../testing/auth-attrappe';
import { keineVerstoesse } from '../../testing/axe';
import { KontoComponent } from './konto.component';
import type { AppKonfiguration } from '../../core/config/config.service';

interface Aufbau {
  container: Element;
  auth: AuthService;
  manager: ManagerAttrappe;
  router: Router;
  aktualisiere: () => void;
}

async function aufbauen(
  angemeldet = false,
  konfiguration: AppKonfiguration | null = KONFIGURATION,
): Promise<Aufbau> {
  const manager = new ManagerAttrappe();
  const { container, detectChanges } = await render(KontoComponent, {
    providers: [provideRouter([]), ...authAnbieter(manager, konfiguration)],
  });
  const auth = TestBed.inject(AuthService);
  if (angemeldet) {
    manager.still = oidcNutzer();
    await auth.stilleErneuerung();
    detectChanges();
  }
  return { container, auth, manager, router: TestBed.inject(Router), aktualisiere: detectChanges };
}

describe('KontoComponent', () => {
  it('zeigt ohne Anmeldung den Weg zum SSO', async () => {
    const { container, manager } = await aufbauen();

    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abmelden' })).not.toBeInTheDocument();
    await keineVerstoesse(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(manager.umleitungen).toEqual([{ zurueck: '/konto' }]);
  });

  it('zeigt Name, E-Mail und Aussteller der angemeldeten Person', async () => {
    const { container, manager, auth, aktualisiere } = await aufbauen(true);

    expect(screen.getByText('Frederik')).toBeInTheDocument();
    expect(screen.getByText('frederik@beimgraben.net · sso.beimgraben.net')).toBeInTheDocument();
    await keineVerstoesse(container);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    aktualisiere();

    expect(manager.entfernt).toBe(1);
    expect(auth.angemeldet()).toBe(false);
    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
  });

  it('schaltet die Darstellung um', async () => {
    const { aktualisiere } = await aufbauen();
    const theme = TestBed.inject(ThemeService);

    await userEvent.click(screen.getByRole('tab', { name: 'Dunkel' }));
    aktualisiere();

    expect(theme.wahl()).toBe('dunkel');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('tab', { name: 'Dunkel' })).toHaveAttribute('aria-selected', 'true');
  });

  it('zeigt Offline und Über mit den Werten, die heute feststehen', async () => {
    await aufbauen();

    for (const titel of ['Offline-Gebiete', 'Ausstehende Übertragungen']) {
      expect(screen.getByText(titel)).toBeInTheDocument();
    }
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText('Methode')).toBeInTheDocument();
    expect(screen.getByText('Quellen und Lizenzen')).toBeInTheDocument();
    expect(screen.getByText('2026-09-09')).toBeInTheDocument();
  });

  it('bleibt lesbar, wenn das Backend keine Konfiguration geliefert hat', async () => {
    await aufbauen(false, null);

    expect(screen.getByText('unbekannt')).toBeInTheDocument();
    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
  });

  it('zeigt einen Issuer ohne URL-Form so, wie er kommt', async () => {
    await aufbauen(true, { ...KONFIGURATION, oidcIssuer: 'sso.beimgraben.net' });

    expect(screen.getByText('frederik@beimgraben.net · sso.beimgraben.net')).toBeInTheDocument();
  });

  it('führt über Zurück auf die Karte', async () => {
    const { router } = await aufbauen();
    const wechsel = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(wechsel).toHaveBeenCalledWith('/karte');
  });
});
