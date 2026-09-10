import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  it('zeigt Bild und Satz, mittig und ohne Kasten', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Keine Art passt zur Suche.' },
    });

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
    expect(container.querySelector('.empty__image svg')).not.toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('nimmt ein eigenes Bild an', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Noch kein Fund.', icon: 'funde' },
    });

    expect(container.querySelector('.empty__image')).not.toBeNull();
  });

  it('stellt Bild, Satz und Handlung in dieser Reihenfolge', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Eigene Einträge stehen im Konto.', action: 'Anmelden' },
    });

    // `querySelectorAll` gibt die Reihenfolge im Baum zurück.
    const order = [...container.querySelectorAll('.empty__image, .empty__text, .empty__button')].map((part) =>
      part.className.split(' ').find((cssClass) => cssClass.startsWith('empty__')),
    );
    expect(order).toEqual(['empty__image', 'empty__text', 'empty__button']);
  });

  it('führt mit einem Knopf hinaus', async () => {
    const { fixture } = await render(EmptyStateComponent, {
      inputs: { text: 'Eigene Einträge stehen im Konto.', action: 'Anmelden' },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(calls).toBe(1);
  });
});
