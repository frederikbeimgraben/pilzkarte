/**
 * Der Farbverlauf der Wertkacheln. Er gehört zu den Daten, nicht zum Theme:
 * die Nachschlagetabelle des Renderings färbt die Kacheln genauso, in hell wie
 * in dunkel. Deshalb feste Farben und kein Token.
 *
 * Eigene Datei ohne Angular: der Färbe-Worker braucht nur diese Liste, und ein
 * Import über die Bausteine zöge das halbe Framework in den Worker.
 */
export const VORHERSAGE_RAMPE: readonly string[] = [
  '#0d0827',
  '#361152',
  '#651a68',
  '#942864',
  '#c23b54',
  '#e55c3c',
  '#f88937',
  '#fcbb59',
  '#fce79b',
];
