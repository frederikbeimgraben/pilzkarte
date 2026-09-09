import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { routes } from './app.routes';
import { karteMitAttrappen, manifestAntwort } from './testing/karte-attrappen';

async function app() {
  manifestAntwort();
  karteMitAttrappen();
  return render(App, { providers: [provideRouter(routes)] });
}

describe('App', () => {
  it('zeigt beim Start die Karte in der Hülle', async () => {
    const { fixture } = await app();
    await fixture.whenStable();

    expect(await screen.findByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
  });

  it('führt jeden Reiter auf seine Seite', async () => {
    const { navigate } = await app();

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
    const { navigate } = await app();

    await navigate('/gibtesnicht');

    expect(await screen.findByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('kennt die Werkstattseite nur in der Entwicklung', async () => {
    const { navigate } = await app();

    await navigate('/bausteine');

    expect(await screen.findByRole('heading', { name: 'Bausteine' })).toBeInTheDocument();
  });
});
