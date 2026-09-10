import { FARBEN, type Farbe } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { OBJEKT_FARBEN, type Farbfeld } from '../../ui';

/**
 * Die sechs Farben des Backends und ihre Werte aus dem Artboard `Zone`.
 *
 * Beide Listen stehen in derselben Reihenfolge; diese Datei ist die einzige
 * Stelle, die das weiß. Nach außen heißt eine Farbe wie im Vertrag (`gruen`),
 * auf der Karte und in der Farbwahl steht ihr Wert.
 */
export function farbeHex(farbe: Farbe): `#${string}` {
  const index = FARBEN.indexOf(farbe);
  return OBJEKT_FARBEN[index === -1 ? 0 : index];
}

/** Die Umkehrung: welche Farbe des Vertrags zu diesem Wert gehört. */
export function farbeAusHex(hex: string): Farbe {
  const index = OBJEKT_FARBEN.findIndex((farbe) => farbe === hex);
  return index === -1 ? 'gruen' : FARBEN[index];
}

/**
 * Die Farbwahl für `ColorSwatches`. Der Wert ist die Farbe selbst, weil der
 * Baustein daraus den Hintergrund des Feldes macht; der Name steht daneben,
 * damit ein Bildschirmleser nicht „#004225“ vorliest.
 */
export function farbFelder(i18n: I18nService): Farbfeld[] {
  return FARBEN.map((farbe) => ({
    wert: farbeHex(farbe),
    label: i18n.translate(`farbe.${farbe}`),
  }));
}
