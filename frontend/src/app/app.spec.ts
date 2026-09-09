import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  it('zeigt beim Start die Karte', async () => {
    const { fixture } = await render(App, { providers: [provideRouter(routes)] });
    await fixture.whenStable();

    expect(await screen.findByRole('heading', { name: 'Karte' })).toBeInTheDocument();
  });

  it('führt jeden Reiter auf seine Seite', async () => {
    const { navigate } = await render(App, { providers: [provideRouter(routes)] });

    for (const [pfad, titel] of [
      ['/arten', 'Arten'],
      ['/eintraege', 'Einträge'],
      ['/konto', 'Konto'],
    ]) {
      await navigate(pfad);
      expect(await screen.findByRole('heading', { name: titel })).toBeInTheDocument();
    }
  });

  it('führt einen unbekannten Pfad auf die Karte', async () => {
    const { navigate } = await render(App, { providers: [provideRouter(routes)] });

    await navigate('/gibtesnicht');

    expect(await screen.findByRole('heading', { name: 'Karte' })).toBeInTheDocument();
  });

  it('kennt die Werkstattseite nur in der Entwicklung', async () => {
    const { navigate } = await render(App, { providers: [provideRouter(routes)] });

    await navigate('/bausteine');

    expect(await screen.findByRole('heading', { name: 'Bausteine' })).toBeInTheDocument();
  });
});
