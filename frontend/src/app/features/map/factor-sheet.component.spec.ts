import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { readLayers, type Layer, type Histogram } from '../../core/tiles/layers';
import { FactorSheetComponent, stepSize } from './factor-sheet.component';
import type { Faktor } from './factors';

const RAIN: Layer = readLayers({
  layers: {
    regen_4w: {
      label: 'Niederschlag der letzten 4 Wochen',
      unit: 'mm',
      static: false,
      low: 0,
      high: 100,
      tiles: 'x',
    },
  },
}).layers[0];

const DISTRIBUTION: Histogram = { klassen: [0, 50, 100], anteile: [0.6, 0.4] };

const FAKTOR: Faktor = { source: 'regen_4w', condition: 'ueber', von: 80, bis: 0, active: true };

function sheet(factor: Faktor = FAKTOR) {
  return render(FactorSheetComponent, {
    inputs: { factor, layer: RAIN, histogramm: DISTRIBUTION, timeScope: 'KW 40 · 2025' },
  });
}

describe('FaktorBlattComponent', () => {
  it('zeigt Verteilung, Bedingung und Anteil der Fläche', async () => {
    const { container } = await sheet();

    expect(screen.getByRole('dialog', { name: 'Faktor' })).toBeInTheDocument();
    expect(screen.getByText('KW 40 · 2025')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Verteilung über Deutschland/ })).toBeInTheDocument();
    // 80 bis 100 mm ist der obere Rand der zweiten Klasse: zwei Fünftel von 0,4.
    expect(
      screen.getByText('Die Bedingung ist auf 16 % der Fläche Deutschlands erfüllt.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('≥ 80 mm').length).toBeGreaterThan(0);
    await noViolations(container);
  });

  it('zeigt bei „über“ nur den unteren Griff', async () => {
    await sheet();

    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Obere Grenze' })).not.toBeInTheDocument();
  });

  it('wechselt die Form der Bedingung und behält die Spanne', async () => {
    const { fixture } = await sheet();
    const applied: Faktor[] = [];
    fixture.componentInstance.apply.subscribe((factor) => applied.push(factor));

    await userEvent.click(screen.getByRole('tab', { name: 'zwischen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(applied[0]).toEqual({ ...FAKTOR, condition: 'zwischen', von: 80, bis: 100 });
  });

  it('zieht die Griffe und lässt sie nicht aneinander vorbei', async () => {
    const { fixture } = await sheet({ ...FAKTOR, condition: 'zwischen', von: 20, bis: 60 });
    const applied: Faktor[] = [];
    fixture.componentInstance.apply.subscribe((factor) => applied.push(factor));

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '90' } });
    fireEvent.input(screen.getByRole('slider', { name: 'Obere Grenze' }), { target: { value: '10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(applied[0].von).toBe(60);
    expect(applied[0].bis).toBe(60);
  });

  it('meldet Entfernen und Abbrechen', async () => {
    const { fixture } = await sheet();
    let removed = 0;
    let closed = 0;
    fixture.componentInstance.remove.subscribe(() => (removed += 1));
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Faktor entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(removed).toBe(1);
    expect(closed).toBe(1);
  });

  it('sagt es, wenn für die Woche keine Verteilung vorliegt', async () => {
    await render(FactorSheetComponent, {
      inputs: { factor: FAKTOR, layer: RAIN, histogramm: null },
    });

    expect(screen.getByText('Für diese Woche liegt keine Verteilung vor.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Verteilung/ })).not.toBeInTheDocument();
  });

  it('wählt die Schrittweite nach der Breite der Skala', () => {
    expect(stepSize({ ...RAIN, low: 0, high: 100 })).toBe(1);
    expect(stepSize({ ...RAIN, low: 0, high: 20 })).toBe(0.1);
    expect(stepSize({ ...RAIN, low: 0, high: 1 })).toBe(0.01);
  });
});
