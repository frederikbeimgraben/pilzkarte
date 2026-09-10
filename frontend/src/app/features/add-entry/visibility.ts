import { VISIBILITIES, type Visibility } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { SegmentOption } from '../../ui';

/** „Privat“ und „Geteilt“ als Segment-Schalter, wie in den Mockups. */
export function visibilitySegments(i18n: I18nService): SegmentOption[] {
  return VISIBILITIES.map((value) => ({ value, label: i18n.translate(`sichtbarkeit.${value}`) }));
}

/** Der Name einer Sichtbarkeit in der Unterzeile eines Objekts, klein. */
export function visibilityText(i18n: I18nService, sichtbarkeit: Visibility): string {
  return i18n.translate(`sichtbarkeit.${sichtbarkeit}`).toLocaleLowerCase(i18n.locale());
}
