/**
 * Die Beispielwerte des Artboards `Bausteine`. Sie stehen hier, damit die
 * Baustein-Seite nur zusammensetzt und die Zahlen nachvollziehbar aus
 * `docs/mockups/bauen.py` stammen.
 */
import type { ZeitleisteWoche } from '../../ui';

/** Die acht Wochen des Artboards. Die Jahresmarke fällt auf KW 41. */
export const BEISPIEL_WOCHEN: readonly ZeitleisteWoche[] = [
  { jahr: 2025, woche: 38, anteil: 0.7, prognose: false },
  { jahr: 2025, woche: 39, anteil: 0.88, prognose: false },
  { jahr: 2025, woche: 40, anteil: 1, prognose: false },
  { jahr: 2026, woche: 41, anteil: 0.76, prognose: true },
  { jahr: 2026, woche: 42, anteil: 0.4, prognose: true },
  { jahr: 2026, woche: 43, anteil: 0.2, prognose: true },
  { jahr: 2026, woche: 44, anteil: 0.08, prognose: true },
  { jahr: 2026, woche: 45, anteil: 0.04, prognose: true },
];

/** Die Saisonkurve aus `funke()`: eine Glocke um die Spitzenwoche. */
function saisonwert(woche: number, spitze: number, versatz: number, faktor: number): number {
  const lage = woche - spitze - versatz;
  return faktor * (Math.exp(-(lage * lage) / 26) + 0.25 * Math.exp(-((lage + 6) * (lage + 6)) / 40));
}

export const BEISPIEL_ALLE_JAHRE: readonly number[] = Array.from({ length: 52 }, (_, i) =>
  saisonwert(i + 1, 40, 0, 1),
);

export const BEISPIEL_LAUFENDES_JAHR: readonly number[] = Array.from({ length: 39 }, (_, i) =>
  saisonwert(i + 1, 40, -1.5, 1.1),
);

/** Die 40 Klassen des Histogramms aus `histogramm()`. */
export const BEISPIEL_HISTOGRAMM: readonly number[] = Array.from({ length: 40 }, (_, i) => {
  const eins = i - 14;
  const zwei = i - 30;
  return Math.exp(-(eins * eins) / 90) + 0.35 * Math.exp(-(zwei * zwei) / 60);
});
