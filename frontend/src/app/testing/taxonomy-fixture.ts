import type { Taxon } from '../core/api/models';
import { PENNY_BUN_BRIEF } from './species-fixture';

/**
 * Die Gattung Boletus: darüber Familie, Ordnung und Klasse, daneben eine zweite
 * Gattung, darunter keine Stufe mehr, aber eine Art.
 */
export const BOLETUS: Taxon = {
  rang: 'gattung',
  slug: 'boletus',
  name: 'Boletus',
  lateinisch: 'Boletus',
  beschreibung: null,
  pfad: [
    { rang: 'klasse', slug: 'agaricomycetes', name: 'Agaricomycetes', lateinisch: 'Agaricomycetes' },
    { rang: 'ordnung', slug: 'boletales', name: 'Röhrlinge', lateinisch: 'Boletales' },
    { rang: 'familie', slug: 'boletaceae', name: 'Boletaceae', lateinisch: 'Boletaceae' },
  ],
  geschwister: [{ rang: 'gattung', slug: 'imleria', name: 'Imleria', lateinisch: 'Imleria' }],
  kinder: [],
  arten: [PENNY_BUN_BRIEF],
  artenZahl: 1,
};

/** Die Familie darüber: Gattungen als Kinder, keine Art unmittelbar an ihr. */
export const BOLETACEAE: Taxon = {
  rang: 'familie',
  slug: 'boletaceae',
  name: 'Boletaceae',
  lateinisch: 'Boletaceae',
  beschreibung: null,
  pfad: [
    { rang: 'klasse', slug: 'agaricomycetes', name: 'Agaricomycetes', lateinisch: 'Agaricomycetes' },
    { rang: 'ordnung', slug: 'boletales', name: 'Röhrlinge', lateinisch: 'Boletales' },
  ],
  geschwister: [{ rang: 'familie', slug: 'suillaceae', name: 'Suillaceae', lateinisch: 'Suillaceae' }],
  kinder: [
    { rang: 'gattung', slug: 'boletus', name: 'Boletus', lateinisch: 'Boletus', artenZahl: 1 },
    { rang: 'gattung', slug: 'imleria', name: 'Imleria', lateinisch: 'Imleria', artenZahl: 0 },
  ],
  arten: [],
  artenZahl: 1,
};

/** Die Wurzel: kein Pfad, kein Nachbar. */
export const AGARICOMYCETES: Taxon = {
  rang: 'klasse',
  slug: 'agaricomycetes',
  name: 'Agaricomycetes',
  lateinisch: 'Agaricomycetes',
  beschreibung: null,
  pfad: [],
  geschwister: [],
  kinder: [{ rang: 'ordnung', slug: 'boletales', name: 'Röhrlinge', lateinisch: 'Boletales', artenZahl: 1 }],
  arten: [],
  artenZahl: 1,
};
