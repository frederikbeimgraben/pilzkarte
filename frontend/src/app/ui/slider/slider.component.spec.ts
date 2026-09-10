import { fireEvent, render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { SliderComponent } from './slider.component';

describe('SliderComponent', () => {
  it('zeigt Beschriftung, Wert und Spur', async () => {
    const { container } = await render(SliderComponent, {
      inputs: { label: 'Deckkraft', value: 40, valueText: '40 %' },
    });

    expect(screen.getByText('Deckkraft')).toBeInTheDocument();
    expect(screen.getByText('40 %')).toBeInTheDocument();
    expect(container.querySelector<HTMLElement>('.slider__chosen')?.style.inlineSize).toBe('40%');
    expect(screen.getByRole('slider', { name: 'Deckkraft' })).toHaveAttribute('aria-valuetext', '40 %');
    await noViolations(container);
  });

  it('meldet den neuen Wert', async () => {
    const { fixture } = await render(SliderComponent, {
      inputs: { label: 'Deckkraft', value: 40 },
    });
    const values: number[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => values.push(value));

    fireEvent.input(screen.getByRole('slider', { name: 'Deckkraft' }), { target: { value: '75' } });

    expect(values).toEqual([75]);
  });

  it('rechnet den Anteil über eine eigene Spanne', async () => {
    const { container } = await render(SliderComponent, {
      inputs: { label: 'Zoom', value: 6, min: 4, max: 8 },
    });

    expect(container.querySelector<HTMLElement>('.slider__chosen')?.style.inlineSize).toBe('50%');
  });
});
