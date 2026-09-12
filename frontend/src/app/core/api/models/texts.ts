import type { Locale } from '../../i18n/translations';

/**
 * Ein Schlüssel der Oberfläche mit seinen Sprachen. `changed` sagt, dass
 * mindestens eine Sprache von der Vorgabe abweicht.
 */
export interface TextEntry {
  key: string;
  values: Record<Locale, string>;
  changed: boolean;
  updatedAt: string;
}

/** `GET /api/texts`: der ganze Katalog, dazu seine Fassung als ETag. */
export interface TextCatalogue {
  revision: string;
  locales: Locale[];
  entries: TextEntry[];
}
