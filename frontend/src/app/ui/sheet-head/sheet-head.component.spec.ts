import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { SheetHeadComponent } from './sheet-head.component';

describe('SheetHeadComponent', () => {
  it('zeigt Art, Woche, Hinweis und die drei Pfeile', async () => {
    const { container, fixture } = await render(SheetHeadComponent, {
      inputs: { titel: 'Steinpilz', woche: 'KW 40 · 2025', hint: '· Prognose', titleAsLink: true },
    });
    const calls: string[] = [];
    fixture.componentInstance.back.subscribe(() => calls.push('zurueck'));
    fixture.componentInstance.playback.subscribe(() => calls.push('abspielen'));
    fixture.componentInstance.vor.subscribe(() => calls.push('vor'));
    fixture.componentInstance.titleClick.subscribe(() => calls.push('titel'));

    expect(screen.getByText('KW 40 · 2025')).toBeInTheDocument();
    expect(screen.getByText('· Prognose')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }));
    await userEvent.click(screen.getByRole('button', { name: 'Wochen abspielen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(calls).toEqual(['zurueck', 'abspielen', 'vor', 'titel']);
    await noViolations(container);
  });

  it('lässt Titel und Pfeile weg, wenn der Kopf sie nicht braucht', async () => {
    await render(SheetHeadComponent, { inputs: { titel: 'Kombination', arrows: false } });

    expect(screen.getByText('Kombination')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nächste Woche' })).not.toBeInTheDocument();
  });
});
