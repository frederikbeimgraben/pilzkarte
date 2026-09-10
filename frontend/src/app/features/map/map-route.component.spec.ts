import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ViewportService } from '../../core/layout/viewport.service';
import { mapWithDoubles, answerManifest, type MapAdapterDouble } from '../../testing/map-doubles';
import { MapRouteComponent } from './map-route.component';

async function route(wide: boolean): Promise<{ double: MapAdapterDouble }> {
  answerManifest();
  const { map: double } = mapWithDoubles();
  await render(MapRouteComponent, {
    providers: [provideRouter([]), { provide: ViewportService, useValue: { wide: signal(wide) } }],
  });
  return { double };
}

describe('KartenRouteComponent', () => {
  it('zeigt die Karte am Telefon', async () => {
    await route(false);

    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('bleibt am Rechner leer, weil die Karte schon in der Hülle hängt', async () => {
    const { double } = await route(true);

    expect(screen.queryByRole('region', { name: 'Karte von Deutschland' })).not.toBeInTheDocument();
    expect(double.started).toBe(0);
  });
});
