import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { leseEbenen, type Ebene } from '../../core/kacheln/ebenen';
import { EBENEN_ROH } from '../../testing/karte-attrappen';
import { EbenenListeComponent } from './ebenen-liste.component';

const EBENEN = leseEbenen(EBENEN_ROH).ebenen;

describe('EbenenListeComponent', () => {
  it('zeigt beide Gruppen mit Einheit und markiert die Wahl', async () => {
    const { container } = await render(EbenenListeComponent, {
      inputs: { ebenen: EBENEN, gewaehlt: 'wald', beschriftung: 'Eingabe-Ebenen' },
    });

    expect(screen.getByText('Je Woche')).toBeInTheDocument();
    expect(screen.getByText('Fest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Waldanteil/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Boden-pH/ })).not.toHaveAttribute('aria-pressed');
    expect(screen.getByRole('group', { name: 'Eingabe-Ebenen' })).toHaveTextContent('Grad');
    await keineVerstoesse(container);
  });

  it('meldet die gewählte Ebene', async () => {
    const { fixture } = await render(EbenenListeComponent, {
      inputs: { ebenen: EBENEN, beschriftung: 'Eingabe-Ebenen' },
    });
    const gewaehlt: Ebene[] = [];
    fixture.componentInstance.auswahl.subscribe((ebene) => gewaehlt.push(ebene));

    await userEvent.click(screen.getByRole('button', { name: /Mitteltemperatur/ }));

    expect(gewaehlt[0].id).toBe('temperatur');
  });

  it('lässt eine leere Gruppe weg', async () => {
    await render(EbenenListeComponent, {
      inputs: {
        ebenen: EBENEN.filter((ebene) => ebene.fest),
        beschriftung: 'Eingabe-Ebenen',
      },
    });

    expect(screen.queryByText('Je Woche')).not.toBeInTheDocument();
    expect(screen.getByText('Fest')).toBeInTheDocument();
  });
});
