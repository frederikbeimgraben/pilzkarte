import { asDate, hectaresText, isoDatum, shortDate, longDate, locationText } from './formats';

describe('Formate', () => {
  it('schreibt ein Datum als ISO-Tag in der Zeitzone des Geräts', () => {
    expect(isoDatum(new Date(2026, 8, 6))).toBe('2026-09-06');
    expect(isoDatum(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('liest ein ISO-Datum als lokalen Tag, nicht als UTC-Zeitpunkt', () => {
    const tag = asDate('2026-09-06');

    expect(tag.getFullYear()).toBe(2026);
    expect(tag.getMonth()).toBe(8);
    expect(tag.getDate()).toBe(6);
  });

  it('fällt bei einem unvollständigen Datum auf den ersten Januar zurück', () => {
    expect(isoDatum(asDate('2026'))).toBe('2026-01-01');
  });

  it('schreibt das lange Datum wie im Artboard Fund', () => {
    expect(longDate('2026-09-06', 'de')).toBe('6. September 2026');
  });

  it('schreibt heute als „Heute“ und sonst kurz', () => {
    expect(shortDate('2026-09-10', 'de', '2026-09-10', 'Heute')).toBe('Heute');
    expect(shortDate('2026-09-06', 'de', '2026-09-10', 'Heute')).toContain('6.');
  });

  it('schreibt den Ort mit vier Stellen', () => {
    expect(locationText(48.5203, 9.0511, 'de')).toEqual({ lat: '48,5203', lon: '9,0511' });
  });

  it('schreibt eine kleine Fläche mit einer Stelle und eine große ohne', () => {
    expect(hectaresText(4.25, 'de')).toBe('4,3');
    expect(hectaresText(42.4, 'de')).toBe('42');
  });
});
