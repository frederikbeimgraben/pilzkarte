import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  it('zeigt einen ruhigen Satz ohne Kasten', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Keine Art passt zur Suche.' },
    });

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('führt mit einem Knopf in Inhaltsbreite hinaus', async () => {
    const { fixture } = await render(EmptyStateComponent, {
      inputs: { text: 'Eigene Einträge stehen im Konto.', action: 'Anmelden' },
    });
    let gerufen = 0;
    fixture.componentInstance.actionClick.subscribe(() => (gerufen += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(gerufen).toBe(1);
  });
});
