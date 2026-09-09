import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { ActionBarComponent } from './action-bar.component';

describe('ActionBarComponent', () => {
  it('stellt Hauptaktion, Gefahr, Nebenaktion und Geist-Knopf auf', async () => {
    const { container, fixture } = await render(ActionBarComponent, {
      inputs: {
        haupt: 'Speichern',
        hauptIcon: 'karte',
        sekundaer: 'Bearbeiten',
        gefahr: 'Löschen',
        geist: 'Abbrechen',
      },
    });
    const gerufen: string[] = [];
    fixture.componentInstance.hauptKlick.subscribe(() => gerufen.push('haupt'));
    fixture.componentInstance.gefahrKlick.subscribe(() => gerufen.push('gefahr'));
    fixture.componentInstance.sekundaerKlick.subscribe(() => gerufen.push('sekundaer'));
    fixture.componentInstance.geistKlick.subscribe(() => gerufen.push('geist'));

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(gerufen).toEqual(['haupt', 'gefahr', 'sekundaer', 'geist']);
    await keineVerstoesse(container);
  });

  it('stellt zwei gleich breite Nebenaktionen nebeneinander', async () => {
    const { container, fixture } = await render(ActionBarComponent, {
      inputs: { haupt: 'Eckpunkt setzen', sekundaer: 'Zone abschließen', zweite: 'Letzten Punkt entfernen' },
    });
    const gerufen: string[] = [];
    fixture.componentInstance.zweiteKlick.subscribe(() => gerufen.push('zweite'));

    expect(container.querySelector('.fuss__reihe')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Letzten Punkt entfernen' }));

    expect(gerufen).toEqual(['zweite']);
  });

  it('zeigt eine einzelne Nebenaktion über die volle Breite', async () => {
    await render(ActionBarComponent, { inputs: { sekundaer: 'Faktor hinzufügen' } });

    expect(screen.getByRole('button', { name: 'Faktor hinzufügen' })).toBeInTheDocument();
  });

  it('schaltet die Hauptaktion ab und nennt darunter den Grund', async () => {
    const { container, fixture } = await render(ActionBarComponent, {
      inputs: {
        haupt: 'Auf der Karte anzeigen',
        hauptDeaktiviert: true,
        unter: 'Für diese Art gibt es keine Vorhersage',
      },
    });
    let gerufen = 0;
    fixture.componentInstance.hauptKlick.subscribe(() => (gerufen += 1));

    const knopf = screen.getByRole('button', { name: 'Auf der Karte anzeigen' });
    expect(knopf).toBeDisabled();
    await userEvent.click(knopf);

    expect(gerufen).toBe(0);
    expect(screen.getByText('Für diese Art gibt es keine Vorhersage')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('zeigt eine einzelne Gefahr-Aktion über die volle Breite', async () => {
    const { container } = await render(ActionBarComponent, { inputs: { gefahr: 'Faktor entfernen' } });

    expect(container.querySelector('.fuss__gefahr')).not.toBeNull();
    expect(container.querySelector('.fuss__reihe')).toBeNull();
  });
});
