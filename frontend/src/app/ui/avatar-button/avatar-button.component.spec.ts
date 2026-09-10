import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { AvatarButtonComponent } from './avatar-button.component';

describe('AvatarButtonComponent', () => {
  it('zeigt die Initiale und meldet den Klick', async () => {
    const { container, fixture } = await render(AvatarButtonComponent, {
      inputs: { name: 'frederik', label: 'Konto' },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    expect(screen.getByText('F')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Konto' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('bleibt ohne Namen leer', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: '   ', label: 'Konto' },
    });

    expect(container.querySelector('span[aria-hidden]')?.textContent).toBe('');
  });
});
