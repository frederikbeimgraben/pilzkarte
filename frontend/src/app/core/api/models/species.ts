/**
 * Der Vertrag des Artenkatalogs, wie ihn `backend/app/modules/arten/schemas.py`
 * festlegt. Jedes Enum des Backends steht hier als Liste seiner Werte, aus der
 * der Typ folgt. Ein Tippfehler im Filter oder in einer Beschriftung fällt damit
 * beim Bauen auf und nicht erst in der Oberfläche, und die Liste selbst steht
 * bereit, wo eine Oberfläche die Werte einer Art einordnen muss.
 */

/**
 * Was die App zu einer Art zeigen kann. Die Datenlage entscheidet. `verwechslung`
 * steht für ein Profil, das man nicht sammelt: es steht im Katalog, weil eine
 * sammelbare Art ihm ähnlich sieht.
 */
export const LEVELS = ['vorhersage', 'saison', 'profil', 'verwechslung'] as const;
export type Level = (typeof LEVELS)[number];

/** Die Verwandtschaft, mit der eine Art im Katalog steht. */
export const GROUPS = [
  'roehrling',
  'raufussroehrling',
  'schmierroehrling',
  'leistling',
  'stoppelpilz',
  'milchling',
  'taeubling',
  'schirmling',
  'champignon',
  'tintling',
  'staeubling',
  'trichterling',
  'roetelritterling',
  'hallimasch',
  'schueppling',
  'ruebling',
  'schleimruebling',
  'seitling',
  'stachelbart',
  'porling',
  'glucke',
  'ritterling',
  'schwindling',
  'schneckling',
  'wulstling',
  'morchel',
  'ohrlappenpilz',
  'gelbfuss',
  'schleierling',
  'rasling',
  'roetling',
  'stachelpilz',
  'becherling',
] as const;
export type Group = (typeof GROUPS)[number];

/** Der Baum, an dem eine Art wächst. Leer bei Zersetzern ohne Wirt. */
export const BAUMARTEN = [
  'fichte',
  'kiefer',
  'tanne',
  'laerche',
  'douglasie',
  'buche',
  'eiche',
  'birke',
  'erle',
  'robinie',
  'eibe',
  'goldregen',
  'heidelbeere',
  'steineiche',
  'hainbuche',
  'hasel',
  'pappel',
  'weide',
  'linde',
  'esche',
  'ulme',
  'ahorn',
  'kastanie',
  'holunder',
  'obstbaum',
] as const;
export type Baumart = (typeof BAUMARTEN)[number];

/** Wann eine Art fruchtet. */
export const SEASONS = ['fruehling', 'sommer', 'herbst', 'winter'] as const;
export type SeasonOfYear = (typeof SEASONS)[number];

/** Was mit einer Art in der Pfanne passieren darf. */
export const EDIBILITIES = [
  'sehrGuterSpeisepilz',
  'guterSpeisepilz',
  'essbar',
  'minderwertig',
  'bedingtEssbar',
  'ungeniessbar',
  'giftig',
  'toedlichGiftig',
] as const;
export type Essbarkeit = (typeof EDIBILITIES)[number];

/** Die Zeilen der Merkmalstabelle, in der Reihenfolge der Artseite. */
export const FEATURE_KEYS = [
  'fruchtkoerper',
  'hut',
  'roehren',
  'lamellen',
  'leisten',
  'stacheln',
  'poren',
  'milch',
  'stiel',
  'fleisch',
  'geruch',
  'geschmack',
  'sporenpulver',
  'reagenzien',
  'vorkommen',
  'zeit',
  'speisewert',
  'schutz',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Ein Merkmal einer Art, mit dem sich die Liste filtern lässt. */
export type Tag = Level | Group | SeasonOfYear | Baumart;

/** Wie oft man die Art findet, laut ihrer Quellseite. */
export const HAEUFIGKEITEN = ['sehrHaeufig', 'haeufig', 'zerstreut', 'selten', 'sehrSelten'] as const;
export type Haeufigkeit = (typeof HAEUFIGKEITEN)[number];

/** Die Stufe der Roten Liste Deutschlands, wenn die Quellseite eine nennt. */
export const GEFAEHRDUNGEN = [
  'vomAussterbenBedroht',
  'starkGefaehrdet',
  'gefaehrdet',
  'unbekanntesAusmass',
  'extremSelten',
  'vorwarnliste',
  'datenUnzureichend',
] as const;
export type Gefaehrdung = (typeof GEFAEHRDUNGEN)[number];

/** Die Chemikalien, mit denen ein Bestimmer eine Farbreaktion auslöst. */
export const REAGENZIEN = [
  'koh',
  'naoh',
  'feso4',
  'guajak',
  'melzer',
  'anilin',
  'phenol',
  'ammoniak',
  'sulfovanillin',
  'formalin',
  'fecl3',
  'wieland',
  'schaeffer',
] as const;
export type Reagenz = (typeof REAGENZIEN)[number];

/** Die beste und die schwächste Stufe der Wertigkeit von 123pilzsuche. */
export const TIER_BEST = 1;
export const TIER_WEAKEST = 6;

/** Ein Messbereich, so wie die Quelle ihn schreibt: 4 bis 20, selten bis 25. */
export interface Spanne {
  von: number;
  bis: number;
  seltenBis: number | null;
}

/**
 * Die Zahlen, die die Quellseite nennt. Was sie nicht nennt, bleibt leer. Hüte
 * misst man in Zentimetern, Sporen in Mikrometern.
 */
export interface Masse {
  hutBreiteCm: Spanne | null;
  fruchtkoerperBreiteCm: Spanne | null;
  fruchtkoerperHoeheCm: Spanne | null;
  stielLaengeCm: Spanne | null;
  stielDickeCm: Spanne | null;
  sporenLaengeUm: Spanne | null;
  sporenBreiteUm: Spanne | null;
}

/** Woher die Angaben stammen und wann sie zuletzt geprüft wurden. */
export interface Source {
  url: string;
  geprueftAm: string;
}

/** Ob die DGfM die Art auf ihrer Positivliste der Speisepilze führt. */
export interface Marktfaehigkeit {
  marktfaehig: boolean;
  quelle: Source;
}

/**
 * Bäume, die die Quelle nicht nennt, das Projekt aber kennt. Sie stehen
 * getrennt, damit man sieht, welche Angabe belegt ist.
 */
export interface BaeumeAusErfahrung {
  baeume: Baumart[];
  quelle: string;
}

/** Eine Chemikalie und die Farbe, die sie am Pilz hervorruft. */
export interface Reagenzeintrag {
  reagenz: Reagenz;
  reaktion: string;
}

/** Eine ISO-Kalenderwoche, so wie sie auf dem Draht steht. */
export interface Week {
  jahr: number;
  woche: number;
}

/** Von welchem bis zu welchem Jahr eine Reihe zählt, beide eingeschlossen. */
export interface YearRange {
  von: number;
  bis: number;
}

/** Eine Art, die man mit dieser verwechselt, und das trennende Merkmal. */
/**
 * Eine Art, die man mit dieser verwechselt, und das trennende Merkmal.
 *
 * D1g stellt den Vertrag gerade um: der Eintrag trägt dann nur noch `slug` und
 * `unterschied`, alles Weitere kommt aufgelöst dazu. Bis dahin heißen dieselben
 * Angaben `merkmal` und `essbar`. Beide Namen stehen hier, damit die Artseite
 * über den Wechsel hinweg läuft.
 */
export interface Confusable {
  name: string;
  /** Das eigene Profil des Partners, wenn es eines gibt. */
  slug: string | null;
  lateinisch?: string;
  unterschied?: string;
  merkmal?: string;
  speisewert?: Essbarkeit;
  essbar?: Essbarkeit;
  warnung?: string | null;
}

/** Eine Art, bei der dieser Pilz als Verwechslung steht. Der Rückweg von D1g. */
export interface Betrifft {
  slug: string;
  name: string;
}

/** Ein Link nach draußen. Nur die Adresse, kein fremder Text. */
export interface Link {
  titel: string;
  url: string;
}

/** Eine Zeile der Merkmalstabelle. */
export interface Feature {
  schluessel: FeatureKey;
  text: string;
}

/**
 * Die Kurve, wie die Artenliste sie klein zeichnet: beide Reihen, denselben
 * Höchstwert. Die Nenner stehen am Kopf der Liste, nicht in jeder Zeile.
 */
export interface SeasonCurveBrief {
  alleJahre: number[];
  laufendesJahr: number[];
  hoechstwert: number;
}

/**
 * Beide Reihen der Saisonkurve, je Kalenderwoche in Prozent. Die zwei
 * `begehungenJeWoche`-Reihen sind der Nenner selbst; die Kurve zeichnet dünne
 * Wochen damit blasser.
 */
export interface SeasonCurveData extends SeasonCurveBrief {
  jahre: YearRange;
  stand: Week;
  begehungen: number;
  begehungenJeWocheAlleJahre: number[];
  begehungenJeWocheLaufendesJahr: number[];
}

/** Eine Art in der Liste. */
export interface SpeciesBrief {
  slug: string;
  name: string;
  lateinisch: string;
  gruppe: Group;
  stufe: Level;
  tags: Tag[];
  geschuetzt: boolean;
  speisewert: Essbarkeit;
  kartenSlug: string | null;
  /** Ob man die Art sammelt. Ein Verwechslungsprofil steht auf `false`. */
  sammelbar: boolean;
  marktfaehig: boolean;
  marktfaehigSchweiz: boolean | null;
  wertigkeit: number | null;
  haeufigkeit: Haeufigkeit | null;
  gefaehrdung: Gefaehrdung | null;
  warnung: string | null;
  jahreszeiten: SeasonOfYear[];
  baeume: Baumart[];
  baeumeAusErfahrung: BaeumeAusErfahrung | null;
  /** Genug Funde für ein eigenes Modell, aber noch keine Karte. */
  vorhersageGeplant: boolean;
  begehungenMitFund: number;
  spitzeWoche: number | null;
  /** Eine Art, die niemand sammelt, trägt keine Saisonkurve. */
  saison: SeasonCurveBrief | null;
}

/** Eine Art mit Profil, so wie die Artseite sie braucht. */
export interface Species extends Omit<SpeciesBrief, 'saison'> {
  marktfaehigkeit: Marktfaehigkeit;
  weitereNamen: string[];
  synonyme: string[];
  masse: Masse;
  quelle: Source;
  merkmale: Feature[];
  reagenzien: Reagenzeintrag[];
  verwechslungen: Confusable[];
  /** Die Arten, bei denen dieser Pilz als Verwechslung steht. Kommt mit D1g. */
  betrifft?: Betrifft[];
  links: Link[];
  saison: SeasonCurveData | null;
}

/**
 * Die Antwort auf `GET /api/arten`. Stand, Jahre und die Begehungen gelten für
 * alle Arten gleich und stehen darum einmal am Kopf statt in jeder Zeile.
 */
export interface SpeciesCatalogue {
  stand: Week;
  jahre: YearRange;
  begehungen: number;
  begehungenJeWocheAlleJahre: number[];
  begehungenJeWocheLaufendesJahr: number[];
  arten: SpeciesBrief[];
}
