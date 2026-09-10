import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  it('zeigt den Titel als Überschrift', async () => {
    const { container } = await render(PageHeaderComponent, { inputs: { titel: 'Arten' } });

    expect(screen.getByRole('heading', { name: 'Arten' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zurück' })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet den Zurück-Knopf, wenn die Seite einen hat', async () => {
    const { fixture } = await render(PageHeaderComponent, {
      inputs: { titel: 'Steinpilz', back: true },
    });
    let calls = 0;
    fixture.componentInstance.backClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(calls).toBe(1);
  });
});
