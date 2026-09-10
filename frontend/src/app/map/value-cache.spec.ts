import { TileCache } from './value-cache';

const tile = (bytes: number): ArrayBuffer => new ArrayBuffer(bytes);

describe('KachelSpeicher', () => {
  it('unterscheidet „unbekannt“ von „geprüft, es gibt sie nicht“', () => {
    const cache = new TileCache(100);

    expect(cache.get('a')).toBeUndefined();

    cache.put('a', null);

    expect(cache.get('a')).toBeNull();
  });

  it('wirft die älteste Kachel weg, wenn die Grenze fällt', () => {
    const cache = new TileCache(100);

    cache.put('a', tile(60));
    cache.put('b', tile(60));

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).not.toBeNull();
    expect(cache.bytes).toBe(60);
    expect(cache.anzahl).toBe(1);
  });

  it('macht eine benutzte Kachel wieder jung', () => {
    const cache = new TileCache(140);
    cache.put('a', tile(60));
    cache.put('b', tile(60));

    cache.get('a');
    cache.put('c', tile(60));

    expect(cache.get('a')).not.toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('zählt eine ersetzte Kachel nicht doppelt', () => {
    const cache = new TileCache(1000);

    cache.put('a', tile(60));
    cache.put('a', tile(20));

    expect(cache.bytes).toBe(20);
    expect(cache.anzahl).toBe(1);
  });

  it('behält die neueste Kachel, auch wenn sie allein zu groß ist', () => {
    const cache = new TileCache(10);

    cache.put('a', tile(50));

    expect(cache.get('a')).not.toBeUndefined();
  });
});
