import { COLORS, type Color } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { OBJECT_COLORS, type ColorSwatch } from '../../ui';

/**
 * Die sechs Farben des Backends und ihre Werte aus dem Artboard `Zone`.
 *
 * Beide Listen stehen in derselben Reihenfolge; diese Datei ist die einzige
 * Stelle, die das weiß. Nach außen heißt eine Farbe wie im Vertrag (`gruen`),
 * auf der Karte und in der Farbwahl steht ihr Wert.
 */
export function colorHex(farbe: Color): `#${string}` {
  const index = COLORS.indexOf(farbe);
  return OBJECT_COLORS[index === -1 ? 0 : index];
}

/** Die Umkehrung: welche Farbe des Vertrags zu diesem Wert gehört. */
export function colorFromHex(hex: string): Color {
  const index = OBJECT_COLORS.findIndex((farbe) => farbe === hex);
  return index === -1 ? 'gruen' : COLORS[index];
}

/**
 * Die Farbwahl für `ColorSwatches`. Der Wert ist die Farbe selbst, weil der
 * Baustein daraus den Hintergrund des Feldes macht; der Name steht daneben,
 * damit ein Bildschirmleser nicht „#004225“ vorliest.
 */
export function colorSwatches(i18n: I18nService): ColorSwatch[] {
  return COLORS.map((farbe) => ({
    value: colorHex(farbe),
    label: i18n.translate(`farbe.${farbe}`),
  }));
}
