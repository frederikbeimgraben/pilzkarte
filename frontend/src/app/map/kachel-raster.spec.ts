import { kachelIndex, sichtbareKacheln } from './kachel-raster';

describe('Kachelraster', () => {
  it('rechnet einen Punkt in seine Kachel um', () => {
    expect(kachelIndex(0, 0, 0)).toEqual([0, 0]);
    expect(kachelIndex(10.0, 51.0, 7)).toEqual([67, 42]);
  });

  it('bleibt am Rand der Welt im Raster', () => {
    expect(kachelIndex(180, 90, 2)).toEqual([3, 0]);
    expect(kachelIndex(-180, -90, 2)).toEqual([0, 3]);
  });

  it('nennt alle Kacheln unter dem Ausschnitt', () => {
    const kacheln = sichtbareKacheln({ west: 9.9, sued: 50.9, ost: 12.9, nord: 51.9 }, 7, 5, 8);

    expect(kacheln.length).toBeGreaterThan(1);
    expect(kacheln.every(([z]) => z === 7)).toBe(true);
    expect(kacheln).toContainEqual([7, 67, 42]);
  });

  it('klemmt die Zoomstufe auf die Stufen des Renderings', () => {
    const tief = sichtbareKacheln({ west: 9.9, sued: 50.9, ost: 10.1, nord: 51.1 }, 13, 5, 8);
    const hoch = sichtbareKacheln({ west: 9.9, sued: 50.9, ost: 10.1, nord: 51.1 }, 2, 5, 8);

    expect(tief[0][0]).toBe(8);
    expect(hoch[0][0]).toBe(5);
  });
});
