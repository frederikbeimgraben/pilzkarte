import { KARTE_ANBIETER } from './karte.tokens';
import { MapLibreAdapter } from './map-adapter';

describe('Karten-Anbieter', () => {
  it('baut die Karte erst, wenn sie gebraucht wird', () => {
    const anbieter = KARTE_ANBIETER as unknown as { useFactory: () => unknown }[];

    expect(anbieter[0].useFactory()).toBeInstanceOf(MapLibreAdapter);
  });
});
