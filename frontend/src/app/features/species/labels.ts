import type { BadgeVariant } from '@stupa-makers/ui-kit';
import type {
  Essbarkeit,
  Gefaehrdung,
  Haeufigkeit,
  FeatureKey,
  Reagenz,
  Level,
  Tag,
} from '../../core/api/models';
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
  douglasie: 'art.tag.douglasie',
  buche: 'art.tag.buche',
  eiche: 'art.tag.eiche',
  birke: 'art.tag.birke',
  erle: 'art.tag.erle',
  robinie: 'art.tag.robinie',
  eibe: 'art.tag.eibe',
  goldregen: 'art.tag.goldregen',
  heidelbeere: 'art.tag.heidelbeere',
  steineiche: 'art.tag.steineiche',
  hainbuche: 'art.tag.hainbuche',
  hasel: 'art.tag.hasel',
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

export const FEATURE_TEXT: Record<FeatureKey, TranslationKey> = {
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
  reagenzien: 'art.merkmal.reagenzien',
  vorkommen: 'art.merkmal.vorkommen',
  zeit: 'art.merkmal.zeit',
  speisewert: 'art.merkmal.speisewert',
  schutz: 'art.merkmal.schutz',
};

export const EDIBILITY_TEXT: Record<Essbarkeit, TranslationKey> = {
  essbar: 'art.essbar.essbar',
  bedingtEssbar: 'art.essbar.bedingtEssbar',
  ungeniessbar: 'art.essbar.ungeniessbar',
  giftig: 'art.essbar.giftig',
  toedlichGiftig: 'art.essbar.toedlichGiftig',
};

/** Grün, was in die Pfanne darf; rot, was schadet; grau der Rest. */
export const EDIBILITY_BADGE: Record<Essbarkeit, BadgeVariant> = {
  essbar: 'success',
  bedingtEssbar: 'warning',
  ungeniessbar: 'warning',
  giftig: 'danger',
  toedlichGiftig: 'danger',
};

/**
 * Wie gefährlich die Stufe ist, tödlich zuerst. Der Chip mit den nicht
 * sammelbaren Arten stellt sie danach auf: wer dort nachschlägt, sucht die
 * Gefahr und nicht das Alphabet.
 */
export const EDIBILITY_DANGER: Record<Essbarkeit, number> = {
  toedlichGiftig: 0,
  giftig: 1,
  ungeniessbar: 2,
  bedingtEssbar: 3,
  essbar: 4,
};

/** Die drei Stufen der Mockups: Vorhersage primär, Saison info, Profil neutral. */
export const LEVEL_BADGE: Record<Level, BadgeVariant> = {
  vorhersage: 'primary',
  saison: 'info',
  profil: 'neutral',
};

/**
 * Die Reihenfolge der Artenliste. Oben steht, wozu die App am meisten sagen
 * kann; innerhalb einer Stufe entscheidet der Name.
 */
export const LEVEL_RANK: Record<Level, number> = {
  vorhersage: 0,
  saison: 1,
  profil: 2,
};

export const HAEUFIGKEIT_TEXT: Record<Haeufigkeit, TranslationKey> = {
  sehrHaeufig: 'art.haeufigkeit.sehrHaeufig',
  haeufig: 'art.haeufigkeit.haeufig',
  zerstreut: 'art.haeufigkeit.zerstreut',
  selten: 'art.haeufigkeit.selten',
  sehrSelten: 'art.haeufigkeit.sehrSelten',
};

export const GEFAEHRDUNG_TEXT: Record<Gefaehrdung, TranslationKey> = {
  vomAussterbenBedroht: 'art.gefaehrdung.vomAussterbenBedroht',
  starkGefaehrdet: 'art.gefaehrdung.starkGefaehrdet',
  gefaehrdet: 'art.gefaehrdung.gefaehrdet',
  unbekanntesAusmass: 'art.gefaehrdung.unbekanntesAusmass',
  extremSelten: 'art.gefaehrdung.extremSelten',
  vorwarnliste: 'art.gefaehrdung.vorwarnliste',
  datenUnzureichend: 'art.gefaehrdung.datenUnzureichend',
};

export const REAGENZ_TEXT: Record<Reagenz, TranslationKey> = {
  koh: 'art.reagenz.koh',
  naoh: 'art.reagenz.naoh',
  feso4: 'art.reagenz.feso4',
  guajak: 'art.reagenz.guajak',
  melzer: 'art.reagenz.melzer',
  anilin: 'art.reagenz.anilin',
  phenol: 'art.reagenz.phenol',
  ammoniak: 'art.reagenz.ammoniak',
  sulfovanillin: 'art.reagenz.sulfovanillin',
  formalin: 'art.reagenz.formalin',
  fecl3: 'art.reagenz.fecl3',
  wieland: 'art.reagenz.wieland',
  schaeffer: 'art.reagenz.schaeffer',
};

/** Die Stufen, die eine Zeile der Liste rot markiert. */
export const GEFAEHRLICH: readonly Essbarkeit[] = ['giftig', 'toedlichGiftig'];

/** Was der Sammler nicht in die Pfanne tun darf. Die Artseite warnt dafür groß. */
export const WARNUNG_TEXT: Partial<Record<Essbarkeit, TranslationKey>> = {
  giftig: 'art.warnung.giftig',
  toedlichGiftig: 'art.warnung.toedlich',
};
