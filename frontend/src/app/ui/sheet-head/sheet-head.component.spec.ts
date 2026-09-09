import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { SheetHeadComponent } from './sheet-head.component';

describe('SheetHeadComponent', () => {
  it('zeigt Art, Woche, Hinweis und die drei Pfeile', async () => {
    const { container, fixture } = await render(SheetHeadComponent, {
      inputs: { titel: 'Steinpilz', woche: 'KW 40 · 2025', hinweis: '· Prognose', titelAlsLink: true },
    });
    const gerufen: string[] = [];
    fixture.componentInstance.zurueck.subscribe(() => gerufen.push('zurueck'));
    fixture.componentInstance.abspielen.subscribe(() => gerufen.push('abspielen'));
    fixture.componentInstance.vor.subscribe(() => gerufen.push('vor'));
    fixture.componentInstance.titelKlick.subscribe(() => gerufen.push('titel'));

    expect(screen.getByText('KW 40 · 2025')).toBeInTheDocument();
    expect(screen.getByText('· Prognose')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Vorige Woche' }));
    await userEvent.click(screen.getByRole('button', { name: 'Wochen abspielen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(gerufen).toEqual(['zurueck', 'abspielen', 'vor', 'titel']);
    await keineVerstoesse(container);
  });

  it('lässt Titel und Pfeile weg, wenn der Kopf sie nicht braucht', async () => {
    await render(SheetHeadComponent, { inputs: { titel: 'Kombination', pfeile: false } });

    expect(screen.getByText('Kombination')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nächste Woche' })).not.toBeInTheDocument();
  });
});
