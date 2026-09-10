import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ListRowComponent } from './list-row.component';

describe('ListRowComponent', () => {
  it('zeigt Titel, Unterzeile, Notiz und Wert', async () => {
    const { container } = await render(ListRowComponent, {
      inputs: {
        titel: 'Pfifferling',
        subline: 'Heute · 2 Stück · Frederik',
        notiz: 'unter Fichten am Hang',
        value: '84 MB',
      },
    });

    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
    expect(screen.getByText('Heute · 2 Stück · Frederik')).toBeInTheDocument();
    expect(screen.getByText('unter Fichten am Hang')).toBeInTheDocument();
    expect(screen.getByText('84 MB')).toBeInTheDocument();
    await noViolations(container);
  });

  it('wird zur Schaltfläche, wenn die Zeile anklickbar ist', async () => {
    const { fixture } = await render(ListRowComponent, {
      inputs: { titel: 'Steinpilz', clickable: true },
    });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(calls).toBe(1);
  });

  it('bleibt ohne Schaltfläche, solange die Zeile nichts öffnet', async () => {
    await render(ListRowComponent, { inputs: { titel: 'Steinpilz' } });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
