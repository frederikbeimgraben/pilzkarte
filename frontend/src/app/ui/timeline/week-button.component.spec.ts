import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { WeekButtonComponent } from './week-button.component';

describe('WeekButtonComponent', () => {
  it('zeichnet den Balken aus dem Anteil', async () => {
    const { container } = await render(WeekButtonComponent, {
      inputs: { jahr: 2026, woche: 40, anteil: 0.5 },
    });

    expect(container.querySelector<HTMLElement>('.woche__balken')?.style.inlineSize).toBe('50%');
    await keineVerstoesse(container);
  });

  it('hält den Balken zwischen null und voll', async () => {
    const { container } = await render(WeekButtonComponent, {
      inputs: { jahr: 2026, woche: 40, anteil: 4 },
    });

    expect(container.querySelector<HTMLElement>('.woche__balken')?.style.inlineSize).toBe('100%');
  });

  it('nennt eine Prognosewoche als solche', async () => {
    await render(WeekButtonComponent, {
      inputs: { jahr: 2026, woche: 41, prognose: true, aktiv: true },
    });

    expect(screen.getByRole('button', { name: 'KW 41 · 2026 · Prognose' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
