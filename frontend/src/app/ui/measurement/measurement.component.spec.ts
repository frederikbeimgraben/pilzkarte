import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { MeasurementComponent } from './measurement.component';

describe('MeasurementComponent', () => {
  it('nennt Zeichen, Spanne und Einheit', async () => {
    const { container } = await render(MeasurementComponent, {
      inputs: { extent: 'hutbreite', spans: [{ von: 4, bis: 20 }], unit: 'cm', label: 'Durchmesser' },
    });

    expect(screen.getByText('4 – 20')).toBeInTheDocument();
    expect(screen.getByText('cm')).toBeInTheDocument();
    // Das Zeichen trägt die Bedeutung, also nennt es sich für Hilfsmittel.
    expect(screen.getByRole('img', { name: 'Durchmesser' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt zwei Strecken als Länge mal Breite', async () => {
    // Die Schreibweise der Bestimmungsbücher: ein Malzeichen, die Einheit
    // einmal am Ende. Zwei Zeilen „Sporen Länge“ und „Sporen Breite“ ließen
    // drei Merkmale erscheinen, wo zwei sind.
    await render(MeasurementComponent, {
      inputs: {
        extent: 'sporenlaenge',
        spans: [
          { von: 13, bis: 18 },
          { von: 5, bis: 6 },
        ],
        unit: 'µm',
        label: 'Sporen',
      },
    });

    expect(screen.getByText('13 – 18 × 5 – 6')).toBeInTheDocument();
    expect(screen.getByText('µm')).toBeInTheDocument();
  });

  it('schreibt einen einzelnen Wert ohne Strich', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'stieldicke', spans: [{ von: 0.3, bis: null }], unit: 'mm', label: 'Dicke' },
    });

    expect(screen.getByText('0,3')).toBeInTheDocument();
  });

  it('schreibt eine Spanne aus zwei gleichen Werten als einen', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'stielhoehe', spans: [{ von: 5, bis: 5 }], unit: 'cm', label: 'Höhe' },
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('setzt Kommas statt Punkte', async () => {
    await render(MeasurementComponent, {
      inputs: {
        extent: 'sporenlaenge',
        spans: [{ von: 12.4, bis: 19.2 }],
        unit: 'µm',
        label: 'Höhe',
      },
    });

    expect(screen.getByText('12,4 – 19,2')).toBeInTheDocument();
  });
});
