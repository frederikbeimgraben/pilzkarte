import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { TimelineComponent, type ZeitleisteWoche } from './timeline.component';

const WOCHEN: ZeitleisteWoche[] = [
  { jahr: 2025, woche: 52, anteil: 0.4, prognose: false },
  { jahr: 2026, woche: 1, anteil: 0.8, prognose: true },
];

describe('TimelineComponent', () => {
  it('zeigt jede Woche und meldet die Wahl', async () => {
    const { container, fixture } = await render(TimelineComponent, {
      inputs: { wochen: WOCHEN, aktiv: { jahr: 2025, woche: 52 }, beschriftung: 'Wochen' },
    });
    const gewaehlt: ZeitleisteWoche[] = [];
    fixture.componentInstance.auswahl.subscribe((woche) => gewaehlt.push(woche));

    expect(screen.getByRole('group', { name: 'Wochen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KW 52 · 2025' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'KW 1 · 2026 · Prognose' }));

    expect(gewaehlt[0].woche).toBe(1);
    await keineVerstoesse(container);
  });

  it('setzt die Jahresmarke auf die erste Woche eines neuen Jahres', async () => {
    const { container } = await render(TimelineComponent, {
      inputs: { wochen: WOCHEN, beschriftung: 'Wochen' },
    });

    const marken = container.querySelectorAll('.woche__jahr');
    expect(marken).toHaveLength(1);
    expect(marken[0].textContent).toBe('2026');
  });
});
