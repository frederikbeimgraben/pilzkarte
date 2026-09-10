import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { FloatingButtonComponent } from './floating-button.component';

describe('FloatingButtonComponent', () => {
  it('trägt seine Beschriftung und meldet den Klick', async () => {
    const { container, fixture } = await render(FloatingButtonComponent, {
      inputs: { icon: 'ebenen', label: 'Ebenen' },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Ebenen' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('kennt eine primäre Variante', async () => {
    const { container } = await render(FloatingButtonComponent, {
      inputs: { icon: 'plus', label: 'Melden', variant: 'primaer' },
    });

    expect(container.querySelector('.floating--primary')).not.toBeNull();
  });
});
