/**
 * Die Beispielwerte des Artboards `Bausteine`. Sie stehen hier, damit die
 * Baustein-Seite nur zusammensetzt und die Zahlen nachvollziehbar aus
 * `docs/mockups/bauen.py` stammen.
 */
import type { TimelineWeek } from '../../ui';

/** Die acht Wochen des Artboards. Die Jahresmarke fällt auf KW 41. */
export const SAMPLE_WEEKS: readonly TimelineWeek[] = [
  { jahr: 2025, woche: 38, share: 0.7, forecast: false },
  { jahr: 2025, woche: 39, share: 0.88, forecast: false },
  { jahr: 2025, woche: 40, share: 1, forecast: false },
  { jahr: 2026, woche: 41, share: 0.76, forecast: true },
  { jahr: 2026, woche: 42, share: 0.4, forecast: true },
  { jahr: 2026, woche: 43, share: 0.2, forecast: true },
  { jahr: 2026, woche: 44, share: 0.08, forecast: true },
  { jahr: 2026, woche: 45, share: 0.04, forecast: true },
];

/** Die Saisonkurve aus `funke()`: eine Glocke um die Spitzenwoche. */
function seasonValue(woche: number, peak: number, offset: number, factor: number): number {
  const position = woche - peak - offset;
  return (
    factor *
    (Math.exp(-(position * position) / 26) + 0.25 * Math.exp(-((position + 6) * (position + 6)) / 40))
  );
}

export const SAMPLE_ALL_YEARS: readonly number[] = Array.from({ length: 52 }, (_, i) =>
  seasonValue(i + 1, 40, 0, 1),
);

export const SAMPLE_CURRENT_YEAR: readonly number[] = Array.from({ length: 39 }, (_, i) =>
  seasonValue(i + 1, 40, -1.5, 1.1),
);

/** Die 40 Klassen des Histogramms aus `histogramm()`. */
export const SAMPLE_HISTOGRAM: readonly number[] = Array.from({ length: 40 }, (_, i) => {
  const one = i - 14;
  const two = i - 30;
  return Math.exp(-(one * one) / 90) + 0.35 * Math.exp(-(two * two) / 60);
});
