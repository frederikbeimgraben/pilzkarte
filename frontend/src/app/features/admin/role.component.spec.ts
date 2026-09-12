import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ANY_ROUTE } from '../../testing/routes';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { noViolations } from '../../testing/axe';
import { RoleComponent } from './role.component';

function routeFor(id: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const params = convertToParamMap({ id });
  return { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } };
}

async function build(
  id: string,
  api = new AccessApiDouble(),
): Promise<{ container: Element; api: AccessApiDouble; router: Router; refresh: () => void }> {
  const { container, detectChanges } = await render(RoleComponent, {
    providers: [provideRouter(ANY_ROUTE), accessApiProvider(api), routeFor(id)],
  });
  detectChanges();
  return { container, api, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('RoleComponent', () => {
  it('legt Name, Beschreibung und die angehakten Rechte vor', async () => {
    const { container } = await build('rolle-berater');

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Pilzberater');
    expect(screen.getByRole('textbox', { name: 'Beschreibung' })).toHaveValue('Arten und Bilder pflegen.');
    expect(screen.getByRole('checkbox', { name: /Profile ändern/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Arten anlegen/ })).not.toBeChecked();
    await noViolations(container);
  });

  it('gruppiert die Rechte nach den vier Bereichen', async () => {
    await build('rolle-berater');

    for (const area of ['Arten', 'Oberfläche', 'Zugang', 'Daten']) {
      expect(screen.getByRole('heading', { name: area })).toBeInTheDocument();
    }
  });

  it('schickt Name, Beschreibung und die neue Rechtemenge', async () => {
    const { api, router, refresh } = await build('rolle-berater');
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('checkbox', { name: /Texte ändern/ }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.patched).toEqual([
      {
        id: 'rolle-berater',
        patch: {
          name: 'Pilzberater',
          description: 'Arten und Bilder pflegen.',
          permissions: ['species.edit', 'image.review', 'text.edit'],
        },
      },
    ]);
    expect(navigate).toHaveBeenCalledWith('/verwaltung/rollen');
  });

  it('nimmt bei einer neuen Rolle ein Kürzel und legt sie an', async () => {
    const { api, refresh } = await build('neu');

    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Übersetzer');
    await userEvent.type(screen.getByRole('textbox', { name: 'Kürzel' }), 'uebersetzer');
    refresh();
    await userEvent.click(screen.getByRole('checkbox', { name: /Texte ändern/ }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.created).toEqual([
      { slug: 'uebersetzer', name: 'Übersetzer', description: null, permissions: ['text.edit'] },
    ]);
  });

  it('lässt sich ohne Namen und Kürzel nicht speichern', async () => {
    await build('neu');

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('gibt einer festen Rolle keine Felder, keine Haken und kein Löschen', async () => {
    const { container } = await build('rolle-admin');

    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rolle löschen' })).not.toBeInTheDocument();
    const box = screen.getByRole('checkbox', { name: /Rollen verwalten/ });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(
      screen.getByText('Admin trägt jedes Recht, auch jedes neue. Diese Rolle lässt sich nicht ändern.'),
    ).toBeInTheDocument();
    await noViolations(container);
  });

  it('fragt vor dem Löschen nach und löscht dann', async () => {
    const { api, router, refresh } = await build('rolle-berater');
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Rolle löschen' }));
    refresh();

    expect(screen.getByText('Die Rolle Pilzberater löschen?')).toBeVisible();

    const inDialog = screen.getAllByRole('button', { name: 'Rolle löschen' });
    await userEvent.click(inDialog[inDialog.length - 1]);
    refresh();

    expect(api.deleted).toEqual(['rolle-berater']);
    expect(navigate).toHaveBeenCalledWith('/verwaltung/rollen');
  });

  it('bricht das Löschen ab, ohne etwas zu schicken', async () => {
    const { api, refresh } = await build('rolle-berater');

    await userEvent.click(screen.getByRole('button', { name: 'Rolle löschen' }));
    refresh();
    await userEvent.click(screen.getAllByRole('button', { name: 'Abbrechen' })[0]);
    refresh();

    expect(api.deleted).toEqual([]);
  });

  it('sagt es, wenn es die Rolle nicht gibt', async () => {
    await build('gibt-es-nicht');

    expect(screen.getByText('Diese Rolle gibt es nicht.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
  });

  it('bleibt auf der Rolle, wenn der Dienst das Speichern abweist', async () => {
    const api = new AccessApiDouble();
    const { router, refresh } = await build('rolle-berater', api);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    api.rejectWith = { type: 'about:blank', title: 'Konflikt', status: 409, detail: 'Geht nicht.' };

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    refresh();

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });
});
