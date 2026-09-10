import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { TimelineComponent, type TimelineWeek } from './timeline.component';

const WEEKS: TimelineWeek[] = [
  { jahr: 2025, woche: 52, share: 0.4, forecast: false },
  { jahr: 2026, woche: 1, share: 0.8, forecast: true },
];

describe('TimelineComponent', () => {
  it('zeigt jede Woche und meldet die Wahl', async () => {
    const { container, fixture } = await render(TimelineComponent, {
      inputs: { wochen: WEEKS, active: { jahr: 2025, woche: 52 }, label: 'Wochen' },
    });
    const selected: TimelineWeek[] = [];
    fixture.componentInstance.chosen.subscribe((woche) => selected.push(woche));

    expect(screen.getByRole('group', { name: 'Wochen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KW 52 · 2025' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'KW 1 · 2026 · Prognose' }));

    expect(selected[0].woche).toBe(1);
    await noViolations(container);
  });

  it('setzt die Jahresmarke auf die erste Woche eines neuen Jahres', async () => {
    const { container } = await render(TimelineComponent, {
      inputs: { wochen: WEEKS, label: 'Wochen' },
    });

    const badges = container.querySelectorAll('.week__year');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('2026');
  });

  it('läuft mit den Pfeiltasten durch die Wochen und hält an den Enden', async () => {
    const { fixture } = await render(TimelineComponent, {
      inputs: { wochen: WEEKS, active: { jahr: 2025, woche: 52 }, label: 'Wochen' },
    });
    const selected: TimelineWeek[] = [];
    fixture.componentInstance.chosen.subscribe((woche) => selected.push(woche));
    screen.getByRole('button', { name: 'KW 52 · 2025' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{End}');
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{ArrowUp}');

    expect(selected.map((woche) => woche.woche)).toEqual([1, 52, 1, 52]);
  });

  it('hält nur die aktive Woche im Tabulator-Weg', async () => {
    await render(TimelineComponent, {
      inputs: { wochen: WEEKS, active: { jahr: 2026, woche: 1 }, label: 'Wochen' },
    });

    expect(screen.getByRole('button', { name: /KW 1 · 2026/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'KW 52 · 2025' })).toHaveAttribute('tabindex', '-1');
  });

  it('bleibt ohne Wochen still', async () => {
    const { container } = await render(TimelineComponent, {
      inputs: { wochen: [], label: 'Wochen' },
    });

    await userEvent.type(screen.getByRole('group', { name: 'Wochen' }), '{ArrowRight}');

    expect(container.querySelectorAll('.week')).toHaveLength(0);
  });
});
