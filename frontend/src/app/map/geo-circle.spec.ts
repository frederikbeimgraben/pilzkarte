import { circleAround } from './geo-circle';

describe('circleAround', () => {
  it('schließt den Ring und trifft die Eckenzahl', () => {
    const ring = circleAround([10, 50], 100, 8);

    expect(ring).toHaveLength(9);
    expect(ring[0]).toEqual(ring[8]);
  });

  it('legt jeden Punkt auf den Radius in Metern', () => {
    const radius = 250;
    const ring = circleAround([10, 50], radius, 16);
    const meters = ring.map(([lon, lat]) => {
      const dx = (lon - 10) * 111320 * Math.cos((50 * Math.PI) / 180);
      const dy = (lat - 50) * 111320;
      return Math.hypot(dx, dy);
    });

    for (const distance of meters) expect(distance).toBeCloseTo(radius, 0);
  });

  it('macht den Kreis nach Norden hin schmaler, nicht breiter', () => {
    const south = circleAround([10, 40], 1000, 4);
    const north = circleAround([10, 70], 1000, 4);

    expect(north[0][0] - 10).toBeGreaterThan(south[0][0] - 10);
    expect(north[1][1] - 70).toBeCloseTo(south[1][1] - 40, 6);
  });
});
