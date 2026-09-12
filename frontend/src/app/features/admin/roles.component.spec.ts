import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ANY_ROUTE } from '../../testing/routes';
import userEvent from '@testing-library/user-event';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { noViolations } from '../../testing/axe';
import { RolesComponent } from './roles.component';

async function build(api = new AccessApiDouble()): Promise<{
  container: Element;
  api: AccessApiDouble;
  router: Router;
}> {
  const { container } = await render(RolesComponent, {
    providers: [provideRouter(ANY_ROUTE), accessApiProvider(api)],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('RolesComponent', () => {
  it('zeigt jede Rolle mit ihren Rechten und Personen', async () => {
    const { container } = await build();

    expect(screen.getByText('Alle Rechte · 1 Person')).toBeInTheDocument();
    expect(screen.getByText('Kein Recht · niemand')).toBeInTheDocument();
    expect(screen.getByText('2 Rechte · 3 Personen')).toBeInTheDocument();
    await noViolations(container);
  });

  it('gibt nur den festen Rollen ein Schloss', async () => {
    await build();

    // Admin und Nutzer stehen fest, Pilzberater ist frei.
    expect(screen.getAllByLabelText('Feste Rolle')).toHaveLength(2);
  });

  it('führt von einer Zeile auf die Rolle', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: /Pilzberater/ }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/rollen', 'rolle-berater']);
  });

  it('legt über den Knopf unten eine neue Rolle an', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/rollen', 'neu']);
  });

  it('zeigt einen Leerzustand, solange keine Rolle da ist', async () => {
    const api = new AccessApiDouble();
    api.roleList = [];
    await build(api);

    expect(screen.getByText('Noch keine Rolle angelegt.')).toBeInTheDocument();
  });
});
