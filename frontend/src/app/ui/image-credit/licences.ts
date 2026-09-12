import type { TranslationKey } from '../../core/i18n/translations';
import type { Licence } from '../../core/api/models';

/**
 * Die Beschriftung einer Lizenz. Sie steht im Katalog und nicht am Enum: die
 * Werte gehen über den Draht, die Beschriftung liest eine Person.
 */
export const LICENCE_TEXT: Record<Licence, TranslationKey> = {
  own: 'bild.lizenz.eigenes',
  cc0: 'bild.lizenz.cc0',
  'cc-by-4': 'bild.lizenz.ccBy4',
  'cc-by-sa-4': 'bild.lizenz.ccBySa4',
  'public-domain': 'bild.lizenz.gemeinfrei',
};
