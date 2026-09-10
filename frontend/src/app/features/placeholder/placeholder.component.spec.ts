import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { PlaceholderComponent } from './placeholder.component';

describe('PlatzhalterComponent', () => {
  it('nennt den Reiter und sagt, dass er noch kommt', async () => {
    const { container } = await render(PlaceholderComponent, { inputs: { titel: 'Einträge' } });

    expect(screen.getByRole('heading', { name: 'Einträge' })).toBeInTheDocument();
    expect(screen.getByText('Dieser Bereich kommt in einem späteren Arbeitspaket.')).toBeInTheDocument();
    await noViolations(container);
  });
});
