import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AnsichtDienst } from '../../core/layout/ansicht.service';
import { karteMitAttrappen, manifestAntwort, type KartenAttrappe } from '../../testing/karte-attrappen';
import { KartenRouteComponent } from './karten-route.component';

async function route(breit: boolean): Promise<{ attrappe: KartenAttrappe }> {
  manifestAntwort();
  const { karte: attrappe } = karteMitAttrappen();
  await render(KartenRouteComponent, {
    providers: [provideRouter([]), { provide: AnsichtDienst, useValue: { breit: signal(breit) } }],
  });
  return { attrappe };
}

describe('KartenRouteComponent', () => {
  it('zeigt die Karte am Telefon', async () => {
    await route(false);

    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('bleibt am Rechner leer, weil die Karte schon in der Hülle hängt', async () => {
    const { attrappe } = await route(true);

    expect(screen.queryByRole('region', { name: 'Karte von Deutschland' })).not.toBeInTheDocument();
    expect(attrappe.gestartet).toBe(0);
  });
});
