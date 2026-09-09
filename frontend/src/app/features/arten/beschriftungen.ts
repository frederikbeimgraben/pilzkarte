import type { BadgeVariant } from '@stupa-makers/ui-kit';
import type { Essbarkeit, MerkmalSchluessel, Stufe, Tag } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/**
 * Der Text zu jedem Enum-Wert des Katalogs. Als vollständige Zuordnung: fehlt
 * ein Wert, meldet es die Typprüfung und nicht erst eine leere Zeile im
 * Katalog.
 */
export const TAG_TEXT: Record<Tag, TranslationKey> = {
  vorhersage: 'art.tag.vorhersage',
  saison: 'art.tag.saison',
  profil: 'art.tag.profil',
  roehrling: 'art.tag.roehrling',
  raufussroehrling: 'art.tag.raufussroehrling',
  schmierroehrling: 'art.tag.schmierroehrling',
  leistling: 'art.tag.leistling',
  stoppelpilz: 'art.tag.stoppelpilz',
  milchling: 'art.tag.milchling',
  taeubling: 'art.tag.taeubling',
  schirmling: 'art.tag.schirmling',
  champignon: 'art.tag.champignon',
  tintling: 'art.tag.tintling',
  staeubling: 'art.tag.staeubling',
  trichterling: 'art.tag.trichterling',
  roetelritterling: 'art.tag.roetelritterling',
  hallimasch: 'art.tag.hallimasch',
  schueppling: 'art.tag.schueppling',
  ruebling: 'art.tag.ruebling',
  schleimruebling: 'art.tag.schleimruebling',
  seitling: 'art.tag.seitling',
  stachelbart: 'art.tag.stachelbart',
  porling: 'art.tag.porling',
  glucke: 'art.tag.glucke',
  ritterling: 'art.tag.ritterling',
  schwindling: 'art.tag.schwindling',
  schneckling: 'art.tag.schneckling',
  wulstling: 'art.tag.wulstling',
  morchel: 'art.tag.morchel',
  ohrlappenpilz: 'art.tag.ohrlappenpilz',
  gelbfuss: 'art.tag.gelbfuss',
  schleierling: 'art.tag.schleierling',
  rasling: 'art.tag.rasling',
  roetling: 'art.tag.roetling',
  stachelpilz: 'art.tag.stachelpilz',
  becherling: 'art.tag.becherling',
  fruehling: 'art.tag.fruehling',
  sommer: 'art.tag.sommer',
  herbst: 'art.tag.herbst',
  winter: 'art.tag.winter',
  fichte: 'art.tag.fichte',
  kiefer: 'art.tag.kiefer',
  tanne: 'art.tag.tanne',
  laerche: 'art.tag.laerche',
  buche: 'art.tag.buche',
  eiche: 'art.tag.eiche',
  birke: 'art.tag.birke',
  hainbuche: 'art.tag.hainbuche',
  pappel: 'art.tag.pappel',
  weide: 'art.tag.weide',
  linde: 'art.tag.linde',
  esche: 'art.tag.esche',
  ulme: 'art.tag.ulme',
  ahorn: 'art.tag.ahorn',
  kastanie: 'art.tag.kastanie',
  holunder: 'art.tag.holunder',
  obstbaum: 'art.tag.obstbaum',
};

export const MERKMAL_TEXT: Record<MerkmalSchluessel, TranslationKey> = {
  fruchtkoerper: 'art.merkmal.fruchtkoerper',
  hut: 'art.merkmal.hut',
  roehren: 'art.merkmal.roehren',
  lamellen: 'art.merkmal.lamellen',
  leisten: 'art.merkmal.leisten',
  stacheln: 'art.merkmal.stacheln',
  poren: 'art.merkmal.poren',
  milch: 'art.merkmal.milch',
  stiel: 'art.merkmal.stiel',
  fleisch: 'art.merkmal.fleisch',
  geruch: 'art.merkmal.geruch',
  geschmack: 'art.merkmal.geschmack',
  sporenpulver: 'art.merkmal.sporenpulver',
  vorkommen: 'art.merkmal.vorkommen',
  zeit: 'art.merkmal.zeit',
  speisewert: 'art.merkmal.speisewert',
  schutz: 'art.merkmal.schutz',
};

export const ESSBARKEIT_TEXT: Record<Essbarkeit, TranslationKey> = {
  speisepilz: 'art.essbar.speisepilz',
  essbar: 'art.essbar.essbar',
  bedingtEssbar: 'art.essbar.bedingtEssbar',
  ohneSpeisewert: 'art.essbar.ohneSpeisewert',
  nichtEmpfohlen: 'art.essbar.nichtEmpfohlen',
  ungeniessbar: 'art.essbar.ungeniessbar',
  giftig: 'art.essbar.giftig',
  toedlichGiftig: 'art.essbar.toedlichGiftig',
};

/** Grün, was in die Pfanne darf; rot, was schadet; grau der Rest. */
export const ESSBARKEIT_BADGE: Record<Essbarkeit, BadgeVariant> = {
  speisepilz: 'success',
  essbar: 'success',
  bedingtEssbar: 'warning',
  ohneSpeisewert: 'neutral',
  nichtEmpfohlen: 'warning',
  ungeniessbar: 'warning',
  giftig: 'danger',
  toedlichGiftig: 'danger',
};

/** Die drei Stufen der Mockups: Vorhersage primär, Saison info, Profil neutral. */
export const STUFE_BADGE: Record<Stufe, BadgeVariant> = {
  vorhersage: 'primary',
  saison: 'info',
  profil: 'neutral',
};

/**
 * Die Reihenfolge der Artenliste. Oben steht, wozu die App am meisten sagen
 * kann; innerhalb einer Stufe entscheidet der Name.
 */
export const STUFE_RANG: Record<Stufe, number> = {
  vorhersage: 0,
  saison: 1,
  profil: 2,
};
