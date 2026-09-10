import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ActionBarComponent } from './action-bar.component';

describe('ActionBarComponent', () => {
  it('stellt Hauptaktion, Gefahr, Nebenaktion und Geist-Knopf auf', async () => {
    const { container, fixture } = await render(ActionBarComponent, {
      inputs: {
        primary: 'Speichern',
        mainIcon: 'karte',
        secondary: 'Bearbeiten',
        danger: 'Löschen',
        ghost: 'Abbrechen',
      },
    });
    const calls: string[] = [];
    fixture.componentInstance.mainClick.subscribe(() => calls.push('haupt'));
    fixture.componentInstance.dangerClick.subscribe(() => calls.push('gefahr'));
    fixture.componentInstance.secondaryClick.subscribe(() => calls.push('sekundaer'));
    fixture.componentInstance.ghostClick.subscribe(() => calls.push('geist'));

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(calls).toEqual(['haupt', 'gefahr', 'sekundaer', 'geist']);
    await noViolations(container);
  });

  it('stellt zwei gleich breite Nebenaktionen nebeneinander', async () => {
    const { container, fixture } = await render(ActionBarComponent, {
      inputs: {
        primary: 'Eckpunkt setzen',
        secondary: 'Zone abschließen',
        second: 'Letzten Punkt entfernen',
      },
    });
    const calls: string[] = [];
    fixture.componentInstance.secondClick.subscribe(() => calls.push('zweite'));

    expect(container.querySelector('.footer__row')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Letzten Punkt entfernen' }));

    expect(calls).toEqual(['zweite']);
  });

  it('zeigt eine einzelne Nebenaktion über die volle Breite', async () => {
    await render(ActionBarComponent, { inputs: { secondary: 'Faktor hinzufügen' } });

    expect(screen.getByRole('button', { name: 'Faktor hinzufügen' })).toBeInTheDocument();
  });

  it('schaltet die Hauptaktion ab und nennt darunter den Grund', async () => {
    const { container, fixture } = await render(ActionBarComponent, {
      inputs: {
        primary: 'Auf der Karte anzeigen',
        mainDisabled: true,
        subline: 'Für diese Art gibt es keine Vorhersage',
      },
    });
    let calls = 0;
    fixture.componentInstance.mainClick.subscribe(() => (calls += 1));

    const button = screen.getByRole('button', { name: 'Auf der Karte anzeigen' });
    expect(button).toBeDisabled();
    await userEvent.click(button);

    expect(calls).toBe(0);
    expect(screen.getByText('Für diese Art gibt es keine Vorhersage')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt eine einzelne Gefahr-Aktion über die volle Breite', async () => {
    const { container } = await render(ActionBarComponent, { inputs: { danger: 'Faktor entfernen' } });

    expect(container.querySelector('.footer__danger')).not.toBeNull();
    expect(container.querySelector('.footer__row')).toBeNull();
  });
});
