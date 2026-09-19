import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { BannerComponent } from './banner.component';

describe('BannerComponent', () => {
  it('meldet, dass keine Verbindung steht', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Keine Verbindung');
    await noViolations(container);
  });

  it('meldet, dass etwas auf die Übertragung wartet', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'pending' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });

  it('meldet eine bereitstehende Fassung ohne Piktogramm', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'update' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Neue Version');
    expect(container.querySelector('.banner__glyph')).toBeNull();
    await noViolations(container);
  });

  it('trägt eine Aktion und meldet ihren Klick', async () => {
    const { container, fixture } = await render(BannerComponent, {
      inputs: { kind: 'update', actionIcon: 'refresh', actionLabel: 'app.update.reload' },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('trägt ohne Aktion keinen Knopf', async () => {
    await render(BannerComponent, { inputs: { kind: 'noConnection' } });

    expect(screen.queryByRole('button')).toBeNull();
  });
});
