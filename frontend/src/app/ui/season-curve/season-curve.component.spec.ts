import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { SeasonCurveComponent, smooth } from './season-curve.component';

const ALLE = Array.from({ length: 52 }, (_, i) => i / 51);
const CURRENT = Array.from({ length: 20 }, (_, i) => i / 51);
/** Die Monatsmarken der Artseite: der Name und die Woche, in der er beginnt. */
const MONTHS = [
  { text: 'Jan', woche: 1 },
  { text: 'Apr', woche: 14 },
  { text: 'Jul', woche: 27 },
  { text: 'Okt', woche: 40 },
  { text: 'Dez', woche: 49 },
];

describe('glaette', () => {
  it('mittelt zentriert über drei Wochen', () => {
    expect(smooth([0, 0, 9, 0, 0], 3)).toEqual([0, 3, 3, 3, 0]);
  });

  it('nimmt am Rand die Nachbarn, die es gibt', () => {
    // Eine gedachte Null vor der ersten Woche zöge den Anfang nach unten.
    expect(smooth([6, 3, 3], 3)).toEqual([4.5, 4, 3]);
  });

  it('lässt die Rohwerte stehen, wenn das Fenster eine Woche breit ist', () => {
    const raw = [1, 9, 2];

    expect(smooth(raw, 1)).toBe(raw);
  });
});

describe('SeasonCurveComponent', () => {
  it('zeichnet die kleine Kurve mit Beschriftung', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: CURRENT, label: 'Saisonkurve' },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 88 36');
    await noViolations(container);
  });

  it('zeichnet die große Kurve mit Achse und Legende', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: CURRENT,
        label: 'Saisonkurve',
        large: true,
        axis: '32 %',
        legendCurrent: '2025 bis KW 39',
        legendYears: '2015 bis 2024',
      },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 330 72');
    expect(screen.getByText('32 %')).toBeInTheDocument();
    expect(screen.getByText('2025 bis KW 39')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt das laufende Jahr weg, solange es keine Reihe dafür gibt', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: [], label: 'Saisonkurve' },
    });

    expect(container.querySelector('.spark__all')).not.toBeNull();
    expect(container.querySelector('.spark__current')).toBeNull();
    expect(container.querySelector('.spark__end')).toBeNull();
  });

  it('endet das laufende Jahr mit einem Punkt auf der letzten vollen Woche', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: CURRENT, label: 'Saisonkurve', large: true },
    });

    // Der Punkt sitzt auf Woche 20 von 52, also bei 19/51 der Breite. Er steht
    // in Anteilen neben dem SVG, weil die verzerrte Fläche ihn oval zöge.
    const point = container.querySelector<HTMLElement>('.spark__end');
    expect(point?.style.left).toBe(`${((19 / 51) * 100).toString()}%`);
  });

  it('schreibt die Monatsmarken unter die Grundlinie', async () => {
    await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: CURRENT,
        label: 'Saisonkurve',
        large: true,
        months: MONTHS,
      },
    });

    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dez')).toBeInTheDocument();
  });

  it.each([390, 1440])('legt bei %i px die Marke Okt unter Woche 40', async (breite) => {
    const { container } = await render(
      `<div style="width: ${breite.toString()}px">
         <app-season-curve
           [alleJahre]="alle" [laufendesJahr]="current" [months]="months"
           [large]="true" label="Saisonkurve" />
       </div>`,
      {
        imports: [SeasonCurveComponent],
        componentProperties: { alle: ALLE, current: CURRENT, months: MONTHS },
      },
    );

    // Die Kurve füllt die Breite (`preserveAspectRatio="none"`), darum ist die
    // Stelle einer Woche ein Anteil und keine Pixelzahl: sie stimmt bei jeder
    // Breite. Der Vergleich holt sie aus dem Pfad, den die Kurve wirklich malt.
    const okt = [...container.querySelectorAll<HTMLElement>('.spark__month')].find(
      (badge) => badge.textContent === 'Okt',
    );
    expect(okt?.style.left).toBe(`${((39 / 51) * 100).toString()}%`);

    // Dieselbe Stelle malt auch die Kurve für Woche 40, bis auf die eine
    // Nachkommastelle, auf die der Pfad gerundet wird.
    const path = container.querySelector('.spark__all')?.getAttribute('d') ?? '';
    const xValues = [...path.matchAll(/L(\d+\.\d)/g)].map((matches) => Number(matches[1]));
    expect((xValues[39] / 330) * 100).toBeCloseTo(Number.parseFloat(okt?.style.left ?? ''), 1);
    expect(container.querySelector('.spark')).toHaveAttribute('preserveAspectRatio', 'none');
  });

  it('zeichnet geglättet, behält aber den Höchstwert der Rohdaten', async () => {
    // Eine einzelne starke Woche zwischen leeren: geglättet steigt die Kurve
    // nur auf ein Drittel, die Achse nennt weiter den rohen Höchstwert.
    const peak = Array.from({ length: 52 }, (_, i) => (i === 25 ? 30 : 0));
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: peak, laufendesJahr: [], label: 'Saisonkurve', large: true },
    });

    const path = container.querySelector('.spark__all')?.getAttribute('d') ?? '';
    const sizes = [...path.matchAll(/,(\d+\.\d)/g)].map((matches) => Number(matches[1]));
    // 72 - 3 - (10/30) * 64 = 47,7 statt 5,0 bei ungeglätteten 30 Prozent.
    expect(Math.min(...sizes)).toBeCloseTo(47.7, 1);
  });

  it('nennt in der Legende die Reihen, nicht das Rechenverfahren', async () => {
    await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: CURRENT,
        label: 'Saisonkurve',
        large: true,
        legendCurrent: 'Schätzung dieses Jahr',
        legendYears: 'Mittelwert 2015 bis 2025',
      },
    });

    // „Geglättet über 3 Wochen“ sagt dem Sammler nichts über die Saison.
    expect(screen.getByText('Schätzung dieses Jahr')).toBeInTheDocument();
    expect(screen.getByText('Mittelwert 2015 bis 2025')).toBeInTheDocument();
    expect(screen.queryByText(/geglättet/)).toBeNull();
  });

  it('zeichnet ohne Begehungszahlen jede Woche gleich kräftig', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: CURRENT, label: 'Saisonkurve' },
    });

    expect(container.querySelector('mask')).toBeNull();
    expect(container.querySelector('.spark__all')?.closest('g')?.getAttribute('mask')).toBeNull();
  });

  it('legt dünne Wochen unter eine Maske, sobald die Begehungen bekannt sind', async () => {
    // Vier magere Wochen am Jahresanfang, danach volle Wochen.
    const begehungen = Array.from({ length: 52 }, (_, i) => (i < 4 ? 5 : 100));
    const { container } = await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: CURRENT,
        label: 'Saisonkurve',
        visitsAllYears: begehungen,
      },
    });

    expect(container.querySelectorAll('.spark__thin')).toHaveLength(4);
    expect(container.querySelector('.spark__all')?.closest('g')?.getAttribute('mask')).toMatch(
      /^url\(#funke-dicht-\d+\)$/,
    );
  });
});
