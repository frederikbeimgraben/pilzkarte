import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import type { Hintergrund } from '../../map/hintergrund';
import { EbenenBlattComponent } from './ebenen-blatt.component';

describe('EbenenBlattComponent', () => {
  it('zeigt die Hintergründe, was noch fehlt, und die Deckkraft', async () => {
    const { container } = await render(EbenenBlattComponent, {
      inputs: { hintergrund: 'automatisch' as Hintergrund, deckkraft: 0.7 },
    });

    expect(screen.getByRole('dialog', { name: 'Auf der Karte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wie die App/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Topografisch')).toBeInTheDocument();
    expect(screen.getAllByText('kommt später')).toHaveLength(2);
    expect(screen.getByText('70 %')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('meldet Hintergrund und Deckkraft', async () => {
    const { fixture } = await render(EbenenBlattComponent, {
      inputs: { hintergrund: 'automatisch' as Hintergrund, deckkraft: 1 },
    });
    const hintergruende: Hintergrund[] = [];
    const deckkraft: number[] = [];
    fixture.componentInstance.hintergrundChange.subscribe((wahl) => hintergruende.push(wahl));
    fixture.componentInstance.deckkraftChange.subscribe((wert) => deckkraft.push(wert));

    await userEvent.click(screen.getByRole('button', { name: 'Dunkel' }));
    fireEvent.input(screen.getByRole('slider', { name: /Deckkraft/ }), { target: { value: '40' } });

    expect(hintergruende).toEqual(['dunkel']);
    expect(deckkraft[0]).toBeCloseTo(0.4);
  });

  it('bietet die Vorhersage darunter nur in der Darstellung Ebene', async () => {
    const { rerender } = await render(EbenenBlattComponent, {
      inputs: { hintergrund: 'hell' as Hintergrund, deckkraft: 1, zeigtEbene: false },
    });

    expect(screen.queryByRole('checkbox', { name: 'Vorhersage darunter zeigen' })).not.toBeInTheDocument();

    await rerender({ inputs: { hintergrund: 'hell' as Hintergrund, deckkraft: 1, zeigtEbene: true } });

    expect(screen.getByRole('checkbox', { name: 'Vorhersage darunter zeigen' })).toBeInTheDocument();
  });

  it('schaltet Marker, Zonen und geteilte Funde', async () => {
    const { fixture } = await render(EbenenBlattComponent, {
      inputs: { hintergrund: 'hell' as Hintergrund, deckkraft: 1 },
    });
    const geschaltet: string[] = [];
    fixture.componentInstance.zeigeMarkerChange.subscribe((an) => geschaltet.push(`marker:${an}`));
    fixture.componentInstance.zeigeZonenChange.subscribe((an) => geschaltet.push(`zonen:${an}`));
    fixture.componentInstance.zeigeGeteilteFundeChange.subscribe((an) => geschaltet.push(`funde:${an}`));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Meine Marker' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Zonen' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Geteilte Funde' }));

    expect(geschaltet).toEqual(['marker:false', 'zonen:false', 'funde:false']);
  });

  it('schließt über die Fußleiste', async () => {
    const { fixture } = await render(EbenenBlattComponent, {
      inputs: { hintergrund: 'hell' as Hintergrund, deckkraft: 1 },
    });
    let geschlossen = 0;
    fixture.componentInstance.schliessen.subscribe(() => (geschlossen += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(geschlossen).toBe(1);
  });
});
