import type { Grenzen } from './map-adapter';
import type { ThemeWirksam } from '../core/theme/theme.service';

/**
 * Die Hintergrundkarte kommt von OpenFreeMap: frei, ohne Schlüssel, in hell und
 * dunkel. Der Stil folgt dem Theme der App.
 */
export const HINTERGRUND: Record<ThemeWirksam, string> = {
  hell: 'https://tiles.openfreemap.org/styles/liberty',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

/**
 * Deutschland mit knapp einem Grad Rand als [Länge, Breite]. Der Rand hält die
 * Grenzregionen vom Bildrand fern; weiter hinaus gibt es keine Vorhersage.
 */
export const DEUTSCHLAND: Grenzen = [
  [4.1, 46.4],
  [16.0, 56.1],
];

/** Zoom 5 zeigt Deutschland ganz, über 14 hat der Vektorstil keine Daten mehr. */
export const ZOOM_MIN = 5;
export const ZOOM_MAX = 14;
