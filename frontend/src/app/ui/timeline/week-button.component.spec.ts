import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { WeekButtonComponent } from './week-button.component';

describe('WeekButtonComponent', () => {
  it('zeichnet den Balken aus dem Anteil', async () => {
    const { container } = await render(WeekButtonComponent, {
      inputs: { jahr: 2026, woche: 40, share: 0.5 },
    });

    expect(container.querySelector<HTMLElement>('.week__bar')?.style.inlineSize).toBe('50%');
    await noViolations(container);
  });

  it('hält den Balken zwischen null und voll', async () => {
    const { container } = await render(WeekButtonComponent, {
      inputs: { jahr: 2026, woche: 40, share: 4 },
    });

    expect(container.querySelector<HTMLElement>('.week__bar')?.style.inlineSize).toBe('100%');
  });

  it('nennt eine Prognosewoche als solche', async () => {
    await render(WeekButtonComponent, {
      inputs: { jahr: 2026, woche: 41, forecast: true, active: true },
    });

    expect(screen.getByRole('button', { name: 'KW 41 · 2026 · Prognose' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
