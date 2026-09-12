import type { BadgeVariant } from '@stupa-makers/ui-kit';
import type {
  Einheit,
  Essbarkeit,
  Fruchtschichtart,
  Hutform,
  Hutmerkmal,
  Hutrandmerkmal,
  Stielmerkmal,
  Lamellenansatz,
  Lamellenschneide,
  Lamellenstand,
  Gefaehrdung,
  Haeufigkeit,
  FeatureKey,
  Reagenz,
  Level,
  Schutzstufe,
  Tag,
  Wechseldauer,
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

/**
 * Die Farbe je Stufe der Essbarkeit. Sie trägt die Warnung, darum steht sie
 * hier als Wert und nicht als Rolle des Kits: das Kit kennt fünf Rollen und
 * müsste „giftig“ und „tödlich giftig“ dieselbe geben.
 */
export const EDIBILITY_COLOUR: Record<Essbarkeit, string> = {
  essbar: '#4f9d6f',
  bedingtEssbar: '#9db44f',
  ungeniessbar: '#95a09a',
  giftig: '#d2915f',
  toedlichGiftig: '#d2685f',
};

/**
 * Die Farbe der Schutzstufe, im Ton der Speisewert-Farben.
 *
 * Sie sagt dasselbe wie die Marke vorher: grau, wo nichts gilt, grün, wo mit
 * Maß gesammelt werden darf, rot, wo es verboten ist.
 */
export const PROTECTION_COLOUR: Record<Schutzstufe, string> = {
  keiner: '#95a09a',
  besondersGeschuetzt: '#4f9d6f',
  strengGeschuetzt: '#d2685f',
};

/**
 * Der Handel ist gedämpft. Ob eine Art auf der Positivliste steht, ist eine
 * Auskunft und keine Warnung; eine eigene Farbe je Fall behauptete ein Urteil.
 */
export const TRADE_COLOUR = '#95a09a';

export const PROTECTION_TEXT: Record<Schutzstufe, TranslationKey> = {
  keiner: 'art.schutz.keiner',
  besondersGeschuetzt: 'art.schutz.besonders',
  strengGeschuetzt: 'art.schutz.streng',
};

/**
 * Das kurze Wort für die Artenliste. Dort steht kein Platz für „für den
 * Eigenbedarf“, und die Zeile soll nur sagen, dass die Art unter Schutz steht.
 */
export const PROTECTION_SHORT: Record<Schutzstufe, TranslationKey> = {
  keiner: 'art.schutz.keiner',
  besondersGeschuetzt: 'arten.geschuetzt',
  strengGeschuetzt: 'art.schutz.streng',
};

/** Nur der Schutz warnt; „nicht geschützt“ ist keine Nachricht. */
export const PROTECTION_BADGE: Record<Schutzstufe, BadgeVariant> = {
  keiner: 'neutral',
  besondersGeschuetzt: 'success',
  strengGeschuetzt: 'danger',
};

export const UNIT_TEXT: Record<Einheit, TranslationKey> = {
  cm: 'art.einheit.cm',
  mm: 'art.einheit.mm',
  um: 'art.einheit.um',
};

export const CHANGE_SPEED_TEXT: Record<Wechseldauer, TranslationKey> = {
  schnell: 'art.verfaerbung.schnell',
  langsam: 'art.verfaerbung.langsam',
};

/** Die vier Marken der Jahresbahn. Sie stehen auf Januar, April, Juli, Oktober. */
export const YEAR_MARKS: readonly TranslationKey[] = [
  'art.monat.jan',
  'art.monat.apr',
  'art.monat.jul',
  'art.monat.okt',
];

/** Die zwölf Monate ausgeschrieben, für den Satz über der Bahn. */
export const MONTH_NAMES: readonly TranslationKey[] = [
  'art.monat.januar',
  'art.monat.februar',
  'art.monat.maerz',
  'art.monat.april',
  'art.monat.mai',
  'art.monat.juni',
  'art.monat.juli',
  'art.monat.august',
  'art.monat.september',
  'art.monat.oktober',
  'art.monat.november',
  'art.monat.dezember',
];

export const HYMENOPHORE_TEXT: Record<Fruchtschichtart, TranslationKey> = {
  lamellen: 'art.fruchtschicht.lamellen',
  roehren: 'art.fruchtschicht.roehren',
  poren: 'art.fruchtschicht.poren',
  stacheln: 'art.fruchtschicht.stacheln',
  leisten: 'art.fruchtschicht.leisten',
};

export const ATTACHMENT_TEXT: Record<Lamellenansatz, TranslationKey> = {
  frei: 'art.ansatz.frei',
  angewachsen: 'art.ansatz.angewachsen',
  ausgebuchtet: 'art.ansatz.ausgebuchtet',
  herablaufend: 'art.ansatz.herablaufend',
};

export const SPACING_TEXT: Record<Lamellenstand, TranslationKey> = {
  eng: 'art.stand.eng',
  normal: 'art.stand.normal',
  weit: 'art.stand.weit',
};

export const EDGE_TEXT: Record<Lamellenschneide, TranslationKey> = {
  glatt: 'art.schneide.glatt',
  gesaegt: 'art.schneide.gesaegt',
  bewimpert: 'art.schneide.bewimpert',
};

export const CAP_SHAPE_TEXT: Record<Hutform, TranslationKey> = {
  halbkugelig: 'art.hutform.halbkugelig',
  gewoelbt: 'art.hutform.gewoelbt',
  flach: 'art.hutform.flach',
  niedergedrueckt: 'art.hutform.niedergedrueckt',
  trichterfoermig: 'art.hutform.trichterfoermig',
  kegelig: 'art.hutform.kegelig',
  glockig: 'art.hutform.glockig',
  eifoermig: 'art.hutform.eifoermig',
  kugelig: 'art.hutform.kugelig',
  muschelfoermig: 'art.hutform.muschelfoermig',
  birnenfoermig: 'art.hutform.birnenfoermig',
  keulig: 'art.hutform.keulig',
  zylindrisch: 'art.hutform.zylindrisch',
};

export const CAP_FEATURE_TEXT: Record<Hutmerkmal, TranslationKey> = {
  gebuckelt: 'art.hutmerkmal.gebuckelt',
  hygrophan: 'art.hutmerkmal.hygrophan',
  gezont: 'art.hutmerkmal.gezont',
  vertieft: 'art.hutmerkmal.vertieft',
  unregelmaessig: 'art.hutmerkmal.unregelmaessig',
  genabelt: 'art.hutmerkmal.genabelt',
};

export const CAP_MARGIN_TEXT: Record<Hutrandmerkmal, TranslationKey> = {
  eingerollt: 'art.hutrand.eingerollt',
  wellig: 'art.hutrand.wellig',
  gerieft: 'art.hutrand.gerieft',
  gerissen: 'art.hutrand.gerissen',
  fransig: 'art.hutrand.fransig',
  eingebogen: 'art.hutrand.eingebogen',
  ueberstehend: 'art.hutrand.ueberstehend',
  scharf: 'art.hutrand.scharf',
  hoeckerig: 'art.hutrand.hoeckerig',
};

export const STEM_FEATURE_TEXT: Record<Stielmerkmal, TranslationKey> = {
  ring: 'art.stielmerkmal.ring',
  knolle: 'art.stielmerkmal.knolle',
  hohl: 'art.stielmerkmal.hohl',
  faserig: 'art.stielmerkmal.faserig',
  beflockt: 'art.stielmerkmal.beflockt',
  voll: 'art.stielmerkmal.voll',
  genattert: 'art.stielmerkmal.genattert',
  genetzt: 'art.stielmerkmal.genetzt',
  behaart: 'art.stielmerkmal.behaart',
  wurzelnd: 'art.stielmerkmal.wurzelnd',
  gerieft: 'art.stielmerkmal.gerieft',
  scheide: 'art.stielmerkmal.scheide',
  bruechig: 'art.stielmerkmal.bruechig',
};
