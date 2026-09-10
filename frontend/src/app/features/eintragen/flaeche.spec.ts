import { alsPolygon, ladeFlaechenrechner } from './flaeche';
import type { Ort } from './eintragen.zustand';

const RING: Ort[] = [
  [9.0, 48.5],
  [9.01, 48.5],
  [9.01, 48.51],
  [9.0, 48.51],
];

describe('Fläche', () => {
  it('schließt den Ring, wie es der Vertrag verlangt', () => {
    const polygon = alsPolygon(RING);

    expect(polygon?.coordinates[0]).toHaveLength(5);
    expect(polygon?.coordinates[0][4]).toEqual([9.0, 48.5]);
  });

  it('lässt einen schon geschlossenen Ring, wie er ist', () => {
    const polygon = alsPolygon([...RING, [9.0, 48.5]]);

    expect(polygon?.coordinates[0]).toHaveLength(5);
  });

  it('gibt unter drei Eckpunkten keine Fläche her', () => {
    expect(alsPolygon(RING.slice(0, 2))).toBeNull();
  });

  it('rechnet die Fläche in Hektar', async () => {
    const rechne = await ladeFlaechenrechner();
    const polygon = alsPolygon(RING);
    if (polygon === null) throw new Error('Der Ring spannt keine Fläche auf.');

    // Ein Hundertstel Grad Länge mal ein Hundertstel Grad Breite sind auf der
    // Höhe von Tübingen rund 82 Hektar.
    expect(rechne(polygon)).toBeGreaterThan(70);
    expect(rechne(polygon)).toBeLessThan(95);
  });

  it('holt Turf nur einmal', async () => {
    expect(await ladeFlaechenrechner()).toBe(await ladeFlaechenrechner());
  });
});
