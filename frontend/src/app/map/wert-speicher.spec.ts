import { KachelSpeicher } from './wert-speicher';

const kachel = (bytes: number): ArrayBuffer => new ArrayBuffer(bytes);

describe('KachelSpeicher', () => {
  it('unterscheidet „unbekannt“ von „geprüft, es gibt sie nicht“', () => {
    const speicher = new KachelSpeicher(100);

    expect(speicher.hole('a')).toBeUndefined();

    speicher.lege('a', null);

    expect(speicher.hole('a')).toBeNull();
  });

  it('wirft die älteste Kachel weg, wenn die Grenze fällt', () => {
    const speicher = new KachelSpeicher(100);

    speicher.lege('a', kachel(60));
    speicher.lege('b', kachel(60));

    expect(speicher.hole('a')).toBeUndefined();
    expect(speicher.hole('b')).not.toBeNull();
    expect(speicher.bytes).toBe(60);
    expect(speicher.anzahl).toBe(1);
  });

  it('macht eine benutzte Kachel wieder jung', () => {
    const speicher = new KachelSpeicher(140);
    speicher.lege('a', kachel(60));
    speicher.lege('b', kachel(60));

    speicher.hole('a');
    speicher.lege('c', kachel(60));

    expect(speicher.hole('a')).not.toBeUndefined();
    expect(speicher.hole('b')).toBeUndefined();
  });

  it('zählt eine ersetzte Kachel nicht doppelt', () => {
    const speicher = new KachelSpeicher(1000);

    speicher.lege('a', kachel(60));
    speicher.lege('a', kachel(20));

    expect(speicher.bytes).toBe(20);
    expect(speicher.anzahl).toBe(1);
  });

  it('behält die neueste Kachel, auch wenn sie allein zu groß ist', () => {
    const speicher = new KachelSpeicher(10);

    speicher.lege('a', kachel(50));

    expect(speicher.hole('a')).not.toBeUndefined();
  });
});
