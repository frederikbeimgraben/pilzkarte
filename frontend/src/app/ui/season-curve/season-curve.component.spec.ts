import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { SeasonCurveComponent, glaette } from './season-curve.component';

const ALLE = Array.from({ length: 52 }, (_, i) => i / 51);
const LAUFEND = Array.from({ length: 20 }, (_, i) => i / 51);

describe('glaette', () => {
  it('mittelt zentriert über drei Wochen', () => {
    expect(glaette([0, 0, 9, 0, 0], 3)).toEqual([0, 3, 3, 3, 0]);
  });

  it('nimmt am Rand die Nachbarn, die es gibt', () => {
    // Eine gedachte Null vor der ersten Woche zöge den Anfang nach unten.
    expect(glaette([6, 3, 3], 3)).toEqual([4.5, 4, 3]);
  });

  it('lässt die Rohwerte stehen, wenn das Fenster eine Woche breit ist', () => {
    const roh = [1, 9, 2];

    expect(glaette(roh, 1)).toBe(roh);
  });
});

describe('SeasonCurveComponent', () => {
  it('zeichnet die kleine Kurve mit Beschriftung', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: LAUFEND, beschriftung: 'Saisonkurve' },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 88 36');
    await keineVerstoesse(container);
  });

  it('zeichnet die große Kurve mit Achse und Legende', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: LAUFEND,
        beschriftung: 'Saisonkurve',
        gross: true,
        achse: '32 %',
        legendeLaufend: '2025 bis KW 39',
        legendeJahre: '2015 bis 2024',
      },
    });

    expect(screen.getByRole('img', { name: 'Saisonkurve' })).toHaveAttribute('viewBox', '0 0 330 72');
    expect(screen.getByText('32 %')).toBeInTheDocument();
    expect(screen.getByText('2025 bis KW 39')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('lässt das laufende Jahr weg, solange es keine Reihe dafür gibt', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: [], beschriftung: 'Saisonkurve' },
    });

    expect(container.querySelector('.funke__alle')).not.toBeNull();
    expect(container.querySelector('.funke__laufend')).toBeNull();
    expect(container.querySelector('.funke__ende')).toBeNull();
  });

  it('endet das laufende Jahr mit einem Punkt auf der letzten vollen Woche', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: LAUFEND, beschriftung: 'Saisonkurve', gross: true },
    });

    const punkt = container.querySelector('.funke__ende');
    // Der Punkt sitzt auf Woche 20 von 52, also bei 19/51 der Breite.
    expect(punkt).toHaveAttribute('cx', ((19 / 51) * 330).toString());
    expect(punkt).toHaveAttribute('r', '3');
  });

  it('schreibt die Monatsmarken unter die Grundlinie', async () => {
    await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: LAUFEND,
        beschriftung: 'Saisonkurve',
        gross: true,
        monate: ['Jan', 'Apr', 'Jul', 'Okt', 'Dez'],
      },
    });

    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dez')).toBeInTheDocument();
  });

  it('zeichnet geglättet, behält aber den Höchstwert der Rohdaten', async () => {
    // Eine einzelne starke Woche zwischen leeren: geglättet steigt die Kurve
    // nur auf ein Drittel, die Achse nennt weiter den rohen Höchstwert.
    const spitze = Array.from({ length: 52 }, (_, i) => (i === 25 ? 30 : 0));
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: spitze, laufendesJahr: [], beschriftung: 'Saisonkurve', gross: true },
    });

    const pfad = container.querySelector('.funke__alle')?.getAttribute('d') ?? '';
    const hoehen = [...pfad.matchAll(/,(\d+\.\d)/g)].map((treffer) => Number(treffer[1]));
    // 72 - 3 - (10/30) * 64 = 47,7 statt 5,0 bei ungeglätteten 30 Prozent.
    expect(Math.min(...hoehen)).toBeCloseTo(47.7, 1);
  });

  it('nennt die Glättung neben der Legende', async () => {
    await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: LAUFEND,
        beschriftung: 'Saisonkurve',
        gross: true,
        legendeLaufend: '2025 bis KW 39',
        legendeJahre: '2015 bis 2024',
      },
    });

    expect(screen.getByText('geglättet über 3 Wochen')).toBeInTheDocument();
  });

  it('schweigt über die Glättung, wenn keine stattfindet', async () => {
    await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: LAUFEND,
        beschriftung: 'Saisonkurve',
        gross: true,
        glaettung: 1,
        legendeLaufend: '2025 bis KW 39',
      },
    });

    expect(screen.queryByText(/geglättet/)).toBeNull();
  });

  it('zeichnet ohne Begehungszahlen jede Woche gleich kräftig', async () => {
    const { container } = await render(SeasonCurveComponent, {
      inputs: { alleJahre: ALLE, laufendesJahr: LAUFEND, beschriftung: 'Saisonkurve' },
    });

    expect(container.querySelector('mask')).toBeNull();
    expect(container.querySelector('.funke__alle')?.closest('g')?.getAttribute('mask')).toBeNull();
  });

  it('legt dünne Wochen unter eine Maske, sobald die Begehungen bekannt sind', async () => {
    // Vier magere Wochen am Jahresanfang, danach volle Wochen.
    const begehungen = Array.from({ length: 52 }, (_, i) => (i < 4 ? 5 : 100));
    const { container } = await render(SeasonCurveComponent, {
      inputs: {
        alleJahre: ALLE,
        laufendesJahr: LAUFEND,
        beschriftung: 'Saisonkurve',
        begehungenAlleJahre: begehungen,
      },
    });

    expect(container.querySelectorAll('.funke__duenn')).toHaveLength(4);
    expect(container.querySelector('.funke__alle')?.closest('g')?.getAttribute('mask')).toMatch(
      /^url\(#funke-dicht-\d+\)$/,
    );
  });
});
