import { googleMapsUrl } from './map-links';

describe('googleMapsUrl', () => {
  it('stellt die Breite vor die Länge, wie Google Maps sie liest', () => {
    expect(googleMapsUrl([9.1829, 48.7758])).toBe(
      'https://www.google.com/maps/search/?api=1&query=48.775800%2C9.182900',
    );
  });

  it('kappt die Stellen bei elf Zentimetern', () => {
    expect(googleMapsUrl([9.123456789, 48.987654321])).toContain('48.987654%2C9.123457');
  });
});
