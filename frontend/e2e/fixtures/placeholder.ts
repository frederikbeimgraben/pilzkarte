import { encode } from '../../tools/png.mjs';

/** Ein Platzhalter des Boards: Verlauf über einen Winkel, dazu Kreise. */
export interface PlaceholderSpec {
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly stops: readonly string[];
  readonly bubbles?: boolean;
}

/** Die drei Kreise: Anteil der Breite, Anteil der Höhe, Kantenlänge. */
const BUBBLES: readonly (readonly [number, number, number])[] = [
  [0.3, 0.4, 34],
  [0.7, 0.25, 22],
  [0.55, 0.7, 44],
];
const BUBBLE_ALPHA = 0.1;
const MIDDLE = 0.55;

/** Zerlegt `#rrggbb` in seine drei Kanäle. */
function channels(hex: string): number[] {
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
}

/** Mischt zwei Farben im Verhältnis `share`. */
function blend(one: readonly number[], other: readonly number[], share: number): number[] {
  return one.map((value, index) => value + (other[index] - value) * share);
}

/** Die Farbe des Verlaufs an der Stelle `t` der Achse. */
function ramp(stops: number[][], t: number): number[] {
  if (stops.length < 3) return blend(stops[0], stops[1], t);
  if (t < MIDDLE) return blend(stops[0], stops[1], t / MIDDLE);
  return blend(stops[1], stops[2], (t - MIDDLE) / (1 - MIDDLE));
}

/** Zeichnet den Platzhalter, wie das Board ihn an die Stelle eines Fotos setzt. */
export function placeholder(spec: PlaceholderSpec): Buffer {
  const { width, height } = spec;
  const stops = spec.stops.map(channels);
  const angle = (spec.angle * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const startX = width / 2 - (dx * length) / 2;
  const startY = height / 2 - (dy * length) / 2;
  const bubbles = (spec.bubbles ? BUBBLES : []).map(([left, top, size]) => ({
    x: left * width + size / 2,
    y: top * height + size / 2,
    r: size / 2,
  }));

  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = ((x + 0.5 - startX) * dx + (y + 0.5 - startY) * dy) / length;
      let colour = ramp(stops, Math.min(1, Math.max(0, t)));
      for (const bubble of bubbles) {
        const far = Math.hypot(x + 0.5 - bubble.x, y + 0.5 - bubble.y);
        const cover = Math.min(1, Math.max(0, bubble.r + 0.5 - far));
        if (cover > 0) colour = blend(colour, [255, 255, 255], BUBBLE_ALPHA * cover);
      }
      const at = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[at + channel] = Math.round(colour[channel]);
      }
    }
  }
  return encode({ width, height, pixels });
}
