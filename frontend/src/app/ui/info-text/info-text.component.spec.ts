import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { InfoTextComponent } from './info-text.component';

describe('InfoTextComponent', () => {
  it('stellt ein Zeichen vor den Hinweis', async () => {
    const { container } = await render('<app-info-text>Diese Art wird nicht gesammelt.</app-info-text>', {
      imports: [InfoTextComponent],
    });

    expect(screen.getByText('Diese Art wird nicht gesammelt.')).toBeInTheDocument();
    // Das Zeichen trägt keine Bedeutung: der Satz daneben sagt alles.
    expect(container.querySelector('.hinweis__zeichen svg')).toHaveAttribute('aria-hidden', 'true');
    await keineVerstoesse(container);
  });
});
