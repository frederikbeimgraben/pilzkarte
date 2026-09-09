import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { PlatzhalterComponent } from './platzhalter.component';

describe('PlatzhalterComponent', () => {
  it('nennt den Reiter und sagt, dass er noch kommt', async () => {
    const { container } = await render(PlatzhalterComponent, { inputs: { titel: 'Einträge' } });

    expect(screen.getByRole('heading', { name: 'Einträge' })).toBeInTheDocument();
    expect(screen.getByText('Dieser Bereich kommt in einem späteren Arbeitspaket.')).toBeInTheDocument();
    await keineVerstoesse(container);
  });
});
