import { SICHTBARKEITEN, type Sichtbarkeit } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { SegmentOption } from '../../ui';

/** „Privat“ und „Geteilt“ als Segment-Schalter, wie in den Mockups. */
export function sichtbarkeitSegmente(i18n: I18nService): SegmentOption[] {
  return SICHTBARKEITEN.map((wert) => ({ wert, label: i18n.translate(`sichtbarkeit.${wert}`) }));
}

/** Der Name einer Sichtbarkeit in der Unterzeile eines Objekts, klein. */
export function sichtbarkeitText(i18n: I18nService, sichtbarkeit: Sichtbarkeit): string {
  return i18n.translate(`sichtbarkeit.${sichtbarkeit}`).toLocaleLowerCase(i18n.locale());
}
