import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { YearBandComponent, bodies } from './year-band.component';

const MARKS = ['Jan', 'Apr', 'Jul', 'Okt'];

describe('YearBandComponent', () => {
  it('zeichnet die Bahn mit vier Marken und nennt sie für Hilfsmittel', async () => {
    const { container } = await render(YearBandComponent, {
      inputs: {
        fromMonth: 6,
        toMonth: 10,
        peakFromMonth: 8,
        peakToMonth: 9,
        months: MARKS,
        label: 'Wachstum von Juni bis Oktober',
      },
    });

    expect(screen.getByRole('img', { name: 'Wachstum von Juni bis Oktober' })).toBeInTheDocument();
    expect(container.querySelectorAll('.year__body')).toHaveLength(2);
    // Die genannte Zeit tritt zurück, sobald die gemessene daneben liegt.
    expect(container.querySelectorAll('.year__body--muted')).toHaveLength(1);
    await noViolations(container);
  });

  it('lässt die genannte Zeit kräftig, wenn keine Kurve daneben steht', async () => {
    const { container } = await render(YearBandComponent, {
      inputs: {
        fromMonth: 4,
        toMonth: 5,
        peakFromMonth: null,
        peakToMonth: null,
        months: MARKS,
        label: 'Wachstum von April bis Mai',
      },
    });

    expect(container.querySelectorAll('.year__body')).toHaveLength(1);
    expect(container.querySelectorAll('.year__body--muted')).toHaveLength(0);
  });

  it('macht aus zusammenhängenden Monaten einen Körper', () => {
    const [body] = bodies(6, 10);

    expect(body.left).toBeCloseTo(41.7, 1);
    expect(body.width).toBeCloseTo(41.7, 1);
  });

  it('zerlegt den Jahreswechsel in zwei Körper', () => {
    // Der Austernseitling steht links und rechts, nicht quer über die Bahn.
    const [start, end] = bodies(11, 2);

    expect(start.left).toBe(0);
    expect(start.width).toBeCloseTo(16.7, 1);
    expect(end.left).toBeCloseTo(83.3, 1);
    expect(end.width).toBeCloseTo(16.7, 1);
  });
});
