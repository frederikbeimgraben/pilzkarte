import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { FloatingButtonComponent } from './floating-button.component';

describe('FloatingButtonComponent', () => {
  it('trägt seine Beschriftung und meldet den Klick', async () => {
    const { container, fixture } = await render(FloatingButtonComponent, {
      inputs: { icon: 'ebenen', beschriftung: 'Ebenen' },
    });
    let gerufen = 0;
    fixture.componentInstance.klick.subscribe(() => (gerufen += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Ebenen' }));

    expect(gerufen).toBe(1);
    await keineVerstoesse(container);
  });

  it('kennt eine primäre Variante', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'plus', beschriftung: 'Melden', variante: 'primaer' },
    });

    expect(container.querySelector('.schwebe--primaer')).not.toBeNull();
  });
});
