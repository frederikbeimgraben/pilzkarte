import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SeasonCurveComponent, smooth, type SeasonSeries } from './season-curve.component';

const ALL = Array.from({ length: 52 }, (_, i) => i / 51);
const CURRENT = Array.from({ length: 20 }, (_, i) => i / 51);

/** Die zwei Reihen der Artseite: alle Jahre als Fläche, das laufende als Linie. */
const SERIES: SeasonSeries[] = [
  { shape: 'area', values: ALL },
  { shape: 'line', values: CURRENT },
];

/** Die Monatsmarken der Artseite: der Name und die Woche, in der er beginnt. */
const MONTHS = [
  { text: 'Jan', week: 1 },
  { text: 'Apr', week: 14 },
  { text: 'Jul', week: 27 },
  { text: 'Okt', week: 40 },
  { text: 'Dez', week: 49 },
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
      inputs: { series: SERIES, label: 'Saisonkurve' },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 88 36');
    await noViolations(container);
  });

  it('zeichnet die große Kurve mit Legende', async () => {
    const series: SeasonSeries[] = [
      { shape: 'area', values: ALL, legend: '2015 bis 2024' },
      { shape: 'line', values: CURRENT, legend: '2025 bis KW 39' },
    ];
    const { container } = await render(SeasonCurveComponent, {
      inputs: { series, label: 'Saisonkurve', large: true },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 330 72');
    expect(screen.getByText('2025 bis KW 39')).toBeInTheDocument();
    await noViolations(container);
  });

  it('stellt die Linie in der Legende vor die Fläche', async () => {
    const series: SeasonSeries[] = [
      { shape: 'area', values: ALL, legend: 'Fläche' },
      { shape: 'line', values: CURRENT, legend: 'Linie' },
    ];
    const { container } = await render(SeasonCurveComponent, {
      inputs: { series, label: 'Saisonkurve', large: true },
    });

    const texts = [...container.querySelectorAll('.spark__legend span')].map((row) => row.textContent);
    expect(texts).toEqual(['Linie', 'Fläche']);
  });

  it('lässt das laufende Jahr weg, solange es keine Reihe dafür gibt', async () => {
    const series: SeasonSeries[] = [{ shape: 'area', values: ALL }];
    const { container } = await render(SeasonCurveComponent, {
      inputs: { series, label: 'Saisonkurve' },
    });

    expect(container.querySelector('.spark__all')).not.toBeNull();
    expect(container.querySelector('.spark__current')).toBeNull();
    expect(container.querySelector('.spark__end')).toBeNull();
  });

  it('endet das laufende Jahr mit einem Punkt auf der letzten vollen Woche', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { series: SERIES, label: 'Saisonkurve', large: true },
    });

    // Der Punkt sitzt auf Woche 20 von 52, also bei 19/51 der Breite. Er steht
    // in Anteilen neben dem SVG, weil die verzerrte Fläche ihn oval zöge.
    const point = container.querySelector<HTMLElement>('.spark__end');
    expect(point?.style.left).toBe(`${((19 / 51) * 100).toString()}%`);
  });

  it('schreibt die Monatsmarken unter die Grundlinie', async () => {
    await render(SeasonCurveComponent, {
      inputs: { series: SERIES, label: 'Saisonkurve', large: true, months: MONTHS },
    });

    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dez')).toBeInTheDocument();
  });

  it.each([390, 1440])('verteilt bei %i px die Monatsmarken gleich', async (width) => {
    const { container } = await render(
      `<div style="width: ${width.toString()}px">
         <app-season-curve [series]="series" [months]="months" [large]="true" label="Saisonkurve" />
       </div>`,
      {
        imports: [SeasonCurveComponent],
        componentProperties: { series: SERIES, months: MONTHS },
      },
    );

    // Die Marken stehen in der Reihenfolge der Monate, die erste am linken
    // Rand, die letzte am rechten. Dazwischen teilt sich der Platz gleich auf.
    const marks = [...container.querySelectorAll<HTMLElement>('.spark__month')];
    expect(marks.map((mark) => mark.textContent)).toEqual(MONTHS.map((month) => month.text));
    const rows = [...container.querySelectorAll<HTMLElement>('.spark__months')];
    expect(rows).toHaveLength(1);
    expect(getComputedStyle(rows[0]).justifyContent).toBe('space-between');
    expect(container.querySelector('.spark')).toHaveAttribute('preserveAspectRatio', 'none');
  });

  it('zeichnet geglättet, behält aber den Höchstwert der Rohdaten', async () => {
    // Eine einzelne starke Woche zwischen leeren: geglättet steigt die Kurve
    // nur auf ein Drittel, die Achse nennt weiter den rohen Höchstwert.
    const peak = Array.from({ length: 52 }, (_, i) => (i === 25 ? 30 : 0));
    const series: SeasonSeries[] = [{ shape: 'area', values: peak }];
    const { container } = await render(SeasonCurveComponent, {
      inputs: { series, label: 'Saisonkurve', large: true },
    });

    const path = container.querySelector('.spark__all')?.getAttribute('d') ?? '';
    const sizes = [...path.matchAll(/,(\d+\.\d)/g)].map((matches) => Number(matches[1]));
    // 72 - 3 - (10/30) * 64 = 47,7 statt 5,0 bei ungeglätteten 30 Prozent.
    expect(Math.min(...sizes)).toBeCloseTo(47.7, 1);
  });

  it('nennt in der Legende die Reihen, nicht das Rechenverfahren', async () => {
    const series: SeasonSeries[] = [
      { shape: 'area', values: ALL, legend: 'Mittelwert 2015 bis 2025' },
      { shape: 'line', values: CURRENT, legend: 'Schätzung dieses Jahr' },
    ];
    await render(SeasonCurveComponent, {
      inputs: { series, label: 'Saisonkurve', large: true },
    });

    // „Geglättet über 3 Wochen“ sagt dem Sammler nichts über die Saison.
    expect(screen.getByText('Schätzung dieses Jahr')).toBeInTheDocument();
    expect(screen.getByText('Mittelwert 2015 bis 2025')).toBeInTheDocument();
    expect(screen.queryByText(/geglättet/)).toBeNull();
  });

  it('zeichnet ohne Begehungszahlen jede Woche gleich kräftig', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { series: SERIES, label: 'Saisonkurve' },
    });

    expect(container.querySelector('mask')).toBeNull();
    expect(container.querySelector('.spark__all')?.closest('g')?.getAttribute('mask')).toBeNull();
  });

  it('legt dünne Wochen unter eine Maske, sobald die Begehungen bekannt sind', async () => {
    // Vier magere Wochen am Jahresanfang, danach volle Wochen.
    const visits = Array.from({ length: 52 }, (_, i) => (i < 4 ? 5 : 100));
    const series: SeasonSeries[] = [
      { shape: 'area', values: ALL, visits },
      { shape: 'line', values: CURRENT },
    ];
    const { container } = await render(SeasonCurveComponent, {
      inputs: { series, label: 'Saisonkurve' },
    });

    expect(container.querySelectorAll('.spark__thin')).toHaveLength(4);
    expect(container.querySelector('.spark__all')?.closest('g')?.getAttribute('mask')).toMatch(
      /^url\(#funke-dicht-\d+\)$/,
    );
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const series: SeasonSeries[] = [
      { shape: 'area', values: ALL, legend: 'Average' },
      { shape: 'line', values: CURRENT, legend: 'This year' },
    ];
    const { container } = await render(SeasonCurveComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { series, label: 'Season curve' },
    });

    noGermanText(container);
  });
});
