import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  it('zeigt Bild und Satz, mittig und ohne Kasten', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Keine Art passt zur Suche.' },
    });

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
    expect(container.querySelector('.leer__bild svg')).not.toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('nimmt ein eigenes Bild an', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Noch kein Fund.', icon: 'funde' },
    });

    expect(container.querySelector('.leer__bild')).not.toBeNull();
  });

  it('stellt Bild, Satz und Handlung in dieser Reihenfolge', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Eigene Einträge stehen im Konto.', action: 'Anmelden' },
    });

    // `querySelectorAll` gibt die Reihenfolge im Baum zurück.
    const reihenfolge = [...container.querySelectorAll('.leer__bild, .leer__text, .leer__knopf')].map(
      (teil) => teil.className.split(' ').find((klasse) => klasse.startsWith('leer__')),
    );
    expect(reihenfolge).toEqual(['leer__bild', 'leer__text', 'leer__knopf']);
  });

  it('führt mit einem Knopf hinaus', async () => {
    const { fixture } = await render(EmptyStateComponent, {
      inputs: { text: 'Eigene Einträge stehen im Konto.', action: 'Anmelden' },
    });
    let gerufen = 0;
    fixture.componentInstance.actionClick.subscribe(() => (gerufen += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(gerufen).toBe(1);
  });
});
