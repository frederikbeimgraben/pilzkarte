import type { TaxonRank } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/**
 * Der Name eines Rangs in der Oberfläche. Als vollständige Zuordnung: fehlt ein
 * Wert, meldet es die Typprüfung und nicht erst eine leere Zeile im Katalog.
 */
export const RANK_TEXT: Record<TaxonRank, TranslationKey> = {
  klasse: 'taxonomie.rang.klasse',
  ordnung: 'taxonomie.rang.ordnung',
  familie: 'taxonomie.rang.familie',
  gattung: 'taxonomie.rang.gattung',
};
