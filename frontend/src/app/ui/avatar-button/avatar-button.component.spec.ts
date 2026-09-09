import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { AvatarButtonComponent } from './avatar-button.component';

describe('AvatarButtonComponent', () => {
  it('zeigt die Initiale und meldet den Klick', async () => {
    const { container, fixture } = await render(AvatarButtonComponent, {
      inputs: { name: 'frederik', beschriftung: 'Konto' },
    });
    let gerufen = 0;
    fixture.componentInstance.klick.subscribe(() => (gerufen += 1));

    expect(screen.getByText('F')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Konto' }));

    expect(gerufen).toBe(1);
    await keineVerstoesse(container);
  });

  it('bleibt ohne Namen leer', async () => {
    const { container } = await render(AvatarButtonComponent, {
      inputs: { name: '   ', beschriftung: 'Konto' },
    });

    expect(container.querySelector('span[aria-hidden]')?.textContent).toBe('');
  });
});
