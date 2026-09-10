import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { leseEbenen, type Ebene, type Histogramm } from '../../core/kacheln/ebenen';
import { FaktorBlattComponent, schrittWeite } from './faktor-blatt.component';
import type { Faktor } from './faktoren';

const REGEN: Ebene = leseEbenen({
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
}).ebenen[0];

const VERTEILUNG: Histogramm = { klassen: [0, 50, 100], anteile: [0.6, 0.4] };

const FAKTOR: Faktor = { quelle: 'regen_4w', bedingung: 'ueber', von: 80, bis: 0, aktiv: true };

function blatt(faktor: Faktor = FAKTOR) {
  return render(FaktorBlattComponent, {
    inputs: { faktor, ebene: REGEN, histogramm: VERTEILUNG, zeitbezug: 'KW 40 · 2025' },
  });
}

describe('FaktorBlattComponent', () => {
  it('zeigt Verteilung, Bedingung und Anteil der Fläche', async () => {
    const { container } = await blatt();

    expect(screen.getByRole('dialog', { name: 'Faktor' })).toBeInTheDocument();
    expect(screen.getByText('KW 40 · 2025')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Verteilung über Deutschland/ })).toBeInTheDocument();
    // 80 bis 100 mm ist der obere Rand der zweiten Klasse: zwei Fünftel von 0,4.
    expect(
      screen.getByText('Die Bedingung ist auf 16 % der Fläche Deutschlands erfüllt.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('≥ 80 mm').length).toBeGreaterThan(0);
    await keineVerstoesse(container);
  });

  it('zeigt bei „über“ nur den unteren Griff', async () => {
    await blatt();

    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Obere Grenze' })).not.toBeInTheDocument();
  });

  it('wechselt die Form der Bedingung und behält die Spanne', async () => {
    const { fixture } = await blatt();
    const uebernommen: Faktor[] = [];
    fixture.componentInstance.uebernehmen.subscribe((faktor) => uebernommen.push(faktor));

    await userEvent.click(screen.getByRole('tab', { name: 'zwischen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(uebernommen[0]).toEqual({ ...FAKTOR, bedingung: 'zwischen', von: 80, bis: 100 });
  });

  it('zieht die Griffe und lässt sie nicht aneinander vorbei', async () => {
    const { fixture } = await blatt({ ...FAKTOR, bedingung: 'zwischen', von: 20, bis: 60 });
    const uebernommen: Faktor[] = [];
    fixture.componentInstance.uebernehmen.subscribe((faktor) => uebernommen.push(faktor));

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '90' } });
    fireEvent.input(screen.getByRole('slider', { name: 'Obere Grenze' }), { target: { value: '10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(uebernommen[0].von).toBe(60);
    expect(uebernommen[0].bis).toBe(60);
  });

  it('meldet Entfernen und Abbrechen', async () => {
    const { fixture } = await blatt();
    let entfernt = 0;
    let geschlossen = 0;
    fixture.componentInstance.entfernen.subscribe(() => (entfernt += 1));
    fixture.componentInstance.schliessen.subscribe(() => (geschlossen += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Faktor entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(entfernt).toBe(1);
    expect(geschlossen).toBe(1);
  });

  it('sagt es, wenn für die Woche keine Verteilung vorliegt', async () => {
    await render(FaktorBlattComponent, {
      inputs: { faktor: FAKTOR, ebene: REGEN, histogramm: null },
    });

    expect(screen.getByText('Für diese Woche liegt keine Verteilung vor.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Verteilung/ })).not.toBeInTheDocument();
  });

  it('wählt die Schrittweite nach der Breite der Skala', () => {
    expect(schrittWeite({ ...REGEN, low: 0, high: 100 })).toBe(1);
    expect(schrittWeite({ ...REGEN, low: 0, high: 20 })).toBe(0.1);
    expect(schrittWeite({ ...REGEN, low: 0, high: 1 })).toBe(0.01);
  });
});
