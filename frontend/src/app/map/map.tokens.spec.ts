import { MAP_PROVIDERS } from './map.tokens';
import { MapLibreAdapter } from './map-adapter';

describe('Karten-Anbieter', () => {
  it('baut die Karte erst, wenn sie gebraucht wird', () => {
    const provider = MAP_PROVIDERS as unknown as { useFactory: () => unknown }[];

    expect(provider[0].useFactory()).toBeInstanceOf(MapLibreAdapter);
  });
});
