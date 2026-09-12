import type { Permission, PermissionArea } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/**
 * Die Beschriftung zu einem Recht und zu einem Bereich. Der Server liefert nur
 * Schlüssel: was eine Person liest, ist Oberflächentext und gehört in den
 * Katalog, damit es übersetzbar bleibt.
 */
export const PERMISSION_TEXT: Readonly<Record<Permission, TranslationKey>> = {
  'species.edit': 'recht.species.edit',
  'species.create': 'recht.species.create',
  'species.delete': 'recht.species.delete',
  'image.upload': 'recht.image.upload',
  'image.review': 'recht.image.review',
  'text.edit': 'recht.text.edit',
  'role.manage': 'recht.role.manage',
  'role.assign': 'recht.role.assign',
  'find.review': 'recht.find.review',
  'run.manage': 'recht.run.manage',
};

/** Nur wo ein Satz mehr sagt als der Titel. Der Rest bleibt einzeilig. */
export const PERMISSION_NOTE: Readonly<Partial<Record<Permission, TranslationKey>>> = {
  'species.edit': 'recht.species.editUnter',
  'image.review': 'recht.image.reviewUnter',
};

export const AREA_TEXT: Readonly<Record<PermissionArea, TranslationKey>> = {
  species: 'bereich.species',
  interface: 'bereich.interface',
  access: 'bereich.access',
  data: 'bereich.data',
};
