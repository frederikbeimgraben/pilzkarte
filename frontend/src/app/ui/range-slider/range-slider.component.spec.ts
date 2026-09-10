import { fireEvent, render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { RangeSliderComponent } from './range-slider.component';

describe('RangeSliderComponent', () => {
  it('führt zwei beschriftete Griffe', async () => {
    const { container } = await render(RangeSliderComponent, {
      inputs: { min: 0, max: 240, von: 80, bis: 200 },
    });

    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toHaveValue('80');
    expect(screen.getByRole('slider', { name: 'Obere Grenze' })).toHaveValue('200');
    await noViolations(container);
  });

  it('lässt die Griffe einander nicht überholen', async () => {
    const { fixture } = await render(RangeSliderComponent, {
      inputs: { min: 0, max: 240, von: 80, bis: 200 },
    });
    const bottom: number[] = [];
    const top: number[] = [];
    fixture.componentInstance.fromChange.subscribe((value) => bottom.push(value));
    fixture.componentInstance.toChange.subscribe((value) => top.push(value));

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '230' } });
    fireEvent.input(screen.getByRole('slider', { name: 'Obere Grenze' }), { target: { value: '10' } });

    expect(bottom).toEqual([200]);
    expect(top).toEqual([80]);
  });

  it('zeichnet die gewählte Spanne über der Spur', async () => {
    const { container } = await render(RangeSliderComponent, {
      inputs: { min: 0, max: 100, von: 25, bis: 75 },
    });

    const span = container.querySelector<HTMLElement>('.rangeslider__chosen');
    expect(span?.style.insetInlineStart).toBe('25%');
  });

  it('teilt nicht durch eine leere Spanne', async () => {
    const { container } = await render(RangeSliderComponent, {
      inputs: { min: 5, max: 5, von: 5, bis: 5 },
    });

    expect(container.querySelector<HTMLElement>('.rangeslider__chosen')?.style.insetInlineStart).toBe('0%');
  });
});
