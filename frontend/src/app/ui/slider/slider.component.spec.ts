import { fireEvent, render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { SliderComponent } from './slider.component';

describe('SliderComponent', () => {
  it('zeigt Beschriftung, Wert und Spur', async () => {
    const { container } = await render(SliderComponent, {
      inputs: { beschriftung: 'Deckkraft', wert: 40, wertText: '40 %' },
    });

    expect(screen.getByText('Deckkraft')).toBeInTheDocument();
    expect(screen.getByText('40 %')).toBeInTheDocument();
    expect(container.querySelector<HTMLElement>('.regler__gewaehlt')?.style.inlineSize).toBe('40%');
    expect(screen.getByRole('slider', { name: 'Deckkraft' })).toHaveAttribute('aria-valuetext', '40 %');
    await keineVerstoesse(container);
  });

  it('meldet den neuen Wert', async () => {
    const { fixture } = await render(SliderComponent, {
      inputs: { beschriftung: 'Deckkraft', wert: 40 },
    });
    const werte: number[] = [];
    fixture.componentInstance.wertChange.subscribe((wert) => werte.push(wert));

    fireEvent.input(screen.getByRole('slider', { name: 'Deckkraft' }), { target: { value: '75' } });

    expect(werte).toEqual([75]);
  });

  it('rechnet den Anteil über eine eigene Spanne', async () => {
    const { container } = await render(SliderComponent, {
      inputs: { beschriftung: 'Zoom', wert: 6, min: 4, max: 8 },
    });

    expect(container.querySelector<HTMLElement>('.regler__gewaehlt')?.style.inlineSize).toBe('50%');
  });
});
