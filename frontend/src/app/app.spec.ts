import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { routes } from './app.routes';
import { karteMitAttrappen, manifestAntwort } from './testing/karte-attrappen';

async function app() {
  manifestAntwort();
  karteMitAttrappen();
  // Die Hülle hängt über den Avatar am Konto und damit an der API; im Test
  // antwortet dort niemand.
  return render(App, {
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
  });
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
      // Die Kopfleiste der Seite ist die einzige H1; „Konto“ steht auf dem
      // Konto-Screen auch als Abschnitt darunter.
      expect(await screen.findByRole('heading', { name: titel, level: 1 })).toBeInTheDocument();
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
