import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ANY_ROUTE } from '../../testing/routes';
import userEvent from '@testing-library/user-event';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import type { Permission } from '../../core/api/models';
import { AdminComponent } from './admin.component';

interface Setup {
  container: Element;
  api: AccessApiDouble;
  router: Router;
  refresh: () => void;
}

async function build(held: Permission[]): Promise<Setup> {
  const api = new AccessApiDouble();
  api.mineAnswer = held;
  const { container, detectChanges } = await render(AdminComponent, {
    providers: [provideRouter(ANY_ROUTE), ...authStubProviders(new AuthStub()), accessApiProvider(api)],
  });
  TestBed.inject(ApplicationRef).tick();
  detectChanges();
  return { container, api, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('AdminComponent', () => {
  it('zeigt nur die Punkte, zu denen ein Recht gehört', async () => {
    const { container } = await build(['text.edit', 'role.assign']);

    expect(screen.getByText('Texte')).toBeInTheDocument();
    expect(screen.getByText('Personen')).toBeInTheDocument();
    expect(screen.queryByText('Rollen')).not.toBeInTheDocument();
    expect(screen.queryByText('Bilder')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('nennt in der Zeile Rollen, wie viele Rollen und Rechte es gibt', async () => {
    await build(['role.manage']);

    expect(screen.getByText('3 Rollen, 10 Rechte')).toBeInTheDocument();
  });

  it('sagt bei einem Punkt ohne Arbeitspaket, wann er kommt', async () => {
    await build(['image.review']);

    expect(screen.getByText('Kommt mit Paket I3.')).toBeInTheDocument();
    // Ohne Weg bleibt die Zeile eine Zeile und keine Schaltfläche.
    expect(screen.queryByRole('button', { name: /Bilder/ })).not.toBeInTheDocument();
  });

  it('führt von der Zeile Texte auf die Texte', async () => {
    const { router } = await build(['text.edit']);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /Texte/ }));

    expect(navigate).toHaveBeenCalledWith('/verwaltung/texte');
  });

  it('führt von der Zeile Rollen auf die Rollenliste', async () => {
    const { router } = await build(['role.manage']);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /Rollen/ }));

    expect(navigate).toHaveBeenCalledWith('/verwaltung/rollen');
  });

  it('zeigt einen Leerzustand, wenn kein Recht der Verwaltung da ist', async () => {
    await build([]);

    expect(screen.getByText('Für die Verwaltung fehlt dir jedes Recht.')).toBeInTheDocument();
  });
});
