import { tileIndex, visibleTiles } from './tile-grid';

describe('Kachelraster', () => {
  it('rechnet einen Punkt in seine Kachel um', () => {
    expect(tileIndex(0, 0, 0)).toEqual([0, 0]);
    expect(tileIndex(10.0, 51.0, 7)).toEqual([67, 42]);
  });

  it('bleibt am Rand der Welt im Raster', () => {
    expect(tileIndex(180, 90, 2)).toEqual([3, 0]);
    expect(tileIndex(-180, -90, 2)).toEqual([0, 3]);
  });

  it('nennt alle Kacheln unter dem Ausschnitt', () => {
    const tiles = visibleTiles({ west: 9.9, south: 50.9, ost: 12.9, nord: 51.9 }, 7, 5, 8);

    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.every(([z]) => z === 7)).toBe(true);
    expect(tiles).toContainEqual([7, 67, 42]);
  });

  it('klemmt die Zoomstufe auf die Stufen des Renderings', () => {
    const deep = visibleTiles({ west: 9.9, south: 50.9, ost: 10.1, nord: 51.1 }, 13, 5, 8);
    const tall = visibleTiles({ west: 9.9, south: 50.9, ost: 10.1, nord: 51.1 }, 2, 5, 8);

    expect(deep[0][0]).toBe(8);
    expect(tall[0][0]).toBe(5);
  });
});
