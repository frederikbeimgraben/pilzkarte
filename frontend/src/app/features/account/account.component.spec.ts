import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';
import { CONFIG, ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { noViolations } from '../../testing/axe';
import { AccountComponent } from './account.component';
import type { AppConfig } from '../../core/config/config.service';

interface Setup {
  container: Element;
  auth: AuthService;
  manager: ManagerDouble;
  router: Router;
  refresh: () => void;
}

async function build(signedIn = false, configuration: AppConfig | null = CONFIG): Promise<Setup> {
  const manager = new ManagerDouble();
  const { container, detectChanges } = await render(AccountComponent, {
    providers: [provideRouter([]), ...authProvider(manager, configuration)],
  });
  const auth = TestBed.inject(AuthService);
  if (signedIn) {
    manager.still = oidcUser();
    await auth.silentRenew();
    detectChanges();
  }
  return { container, auth, manager, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('KontoComponent', () => {
  it('zeigt ohne Anmeldung den Weg zum SSO', async () => {
    const { container, manager } = await build();

    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abmelden' })).not.toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(manager.redirects).toEqual([{ back: '/konto' }]);
  });

  it('zeigt Name, E-Mail und Aussteller der angemeldeten Person', async () => {
    const { container, manager, auth, refresh } = await build(true);

    expect(screen.getByText('Frederik')).toBeInTheDocument();
    expect(screen.getByText('frederik@beimgraben.net · sso.beimgraben.net')).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    refresh();

    expect(manager.removed).toBe(1);
    expect(auth.signedIn()).toBe(false);
    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
  });

  it('schaltet die Darstellung um', async () => {
    const { refresh } = await build();
    const theme = TestBed.inject(ThemeService);

    await userEvent.click(screen.getByRole('tab', { name: 'Dunkel' }));
    refresh();

    expect(theme.choice()).toBe('dunkel');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('tab', { name: 'Dunkel' })).toHaveAttribute('aria-selected', 'true');
  });

  it('schaltet die Sprache um und merkt sie sich', async () => {
    const { refresh } = await build();
    const i18n = TestBed.inject(I18nService);

    await userEvent.click(screen.getByRole('tab', { name: 'English' }));
    refresh();

    expect(i18n.choice()).toBe('en');
    expect(localStorage.getItem('pilzkarte.sprache')).toBe('en');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('tab', { name: 'English' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lässt die Sprache dem Browser folgen', async () => {
    const { refresh } = await build();
    const i18n = TestBed.inject(I18nService);

    await userEvent.click(screen.getAllByRole('tab', { name: 'System' })[1]);
    refresh();

    expect(i18n.choice()).toBe('system');
  });

  it('zeigt Offline und Über mit den Werten, die heute feststehen', async () => {
    await build();

    for (const titel of ['Offline-Gebiete', 'Ausstehende Übertragungen']) {
      expect(screen.getByText(titel)).toBeInTheDocument();
    }
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText('Methode')).toBeInTheDocument();
    expect(screen.getByText('Quellen und Lizenzen')).toBeInTheDocument();
    expect(screen.getByText('2026-09-09')).toBeInTheDocument();
  });

  it('bleibt lesbar, wenn das Backend keine Konfiguration geliefert hat', async () => {
    await build(false, null);

    expect(screen.getByText('unbekannt')).toBeInTheDocument();
    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
  });

  it('zeigt einen Issuer ohne URL-Form so, wie er kommt', async () => {
    await build(true, { ...CONFIG, oidcIssuer: 'sso.beimgraben.net' });

    expect(screen.getByText('frederik@beimgraben.net · sso.beimgraben.net')).toBeInTheDocument();
  });

  it('führt über Zurück auf die Karte', async () => {
    const { router } = await build();
    const change = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(change).toHaveBeenCalledWith('/karte');
  });
});
