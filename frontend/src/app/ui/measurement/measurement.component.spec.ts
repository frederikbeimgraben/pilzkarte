import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { MeasurementComponent } from './measurement.component';

describe('MeasurementComponent', () => {
  it('nennt Zeichen, Spanne und Einheit', async () => {
    const { container } = await render(MeasurementComponent, {
      inputs: { extent: 'hutbreite', from: 4, to: 20, unit: 'cm', label: 'Durchmesser' },
    });

    expect(screen.getByText('4 – 20')).toBeInTheDocument();
    expect(screen.getByText('cm')).toBeInTheDocument();
    // Das Zeichen trägt die Bedeutung, also nennt es sich für Hilfsmittel.
    expect(screen.getByRole('img', { name: 'Durchmesser' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt einen einzelnen Wert ohne Strich', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'stieldicke', from: 0.3, to: null, unit: 'mm', label: 'Dicke' },
    });

    expect(screen.getByText('0,3')).toBeInTheDocument();
  });

  it('schreibt eine Spanne aus zwei gleichen Werten als einen', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'stielhoehe', from: 5, to: 5, unit: 'cm', label: 'Höhe' },
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('setzt Kommas statt Punkte', async () => {
    await render(MeasurementComponent, {
      inputs: { extent: 'sporenlaenge', from: 12.4, to: 19.2, unit: 'µm', label: 'Höhe' },
    });

    expect(screen.getByText('12,4 – 19,2')).toBeInTheDocument();
  });
});
