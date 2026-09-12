/**
 * Der Vertrag des Artenkatalogs, wie ihn `backend/app/modules/arten/schemas.py`
 * festlegt. Jedes Enum des Backends steht hier als Liste seiner Werte, aus der
 * der Typ folgt. Ein Tippfehler im Filter oder in einer Beschriftung fällt damit
 * beim Bauen auf und nicht erst in der Oberfläche, und die Liste selbst steht
 * bereit, wo eine Oberfläche die Werte einer Art einordnen muss.
 */

/**
 * Was die App zu einer Art zeigen kann. Die Datenlage entscheidet. Eine
 * Verwechslung ist keine Stufe: sie ist eine Beziehung zwischen zwei Arten und
 * steht in `verwechslungen`.
 */
export const LEVELS = ['vorhersage', 'saison', 'profil'] as const;
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

/**
 * Wie gefährlich eine Art in der Pfanne ist. Fünf Stufen, mehr nicht. Wie gut
 * eine essbare Art schmeckt, steht als `wertigkeit` daneben.
 */
export const EDIBILITIES = ['essbar', 'bedingtEssbar', 'ungeniessbar', 'giftig', 'toedlichGiftig'] as const;
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

/** Die Einheit einer Messung. Sie steht am Wert, nicht im Feldnamen. */
export const EINHEITEN = ['cm', 'mm', 'um'] as const;
export type Einheit = (typeof EINHEITEN)[number];

/**
 * Ein Messbereich, so wie die Quelle ihn schreibt: 4 bis 20, selten bis 25.
 * `seltenVon` und `seltenBis` sind die Ausreißer, `beschreibung` trägt den
 * Satz, wo er mehr sagt als die Zahlen.
 */
export interface Spanne {
  von: number;
  bis: number;
  seltenVon: number | null;
  seltenBis: number | null;
  einheit: Einheit;
  beschreibung: string | null;
}

/** Eine Farbe mit Namen und Wert. Der Name steht links, der Wert in der Fläche. */
export interface Farbe {
  name: string;
  hex: string;
}

/** Wie schnell eine Verfärbung eintritt. */
export const WECHSELDAUERN = ['schnell', 'langsam'] as const;
export type Wechseldauer = (typeof WECHSELDAUERN)[number];

/** Was beim Anschnitt oder auf Druck passiert. Ohne `nach` gibt es nichts zu zeigen. */
export interface Verfaerbung {
  von: Farbe[];
  nach: Farbe[];
  dauer: Wechseldauer | null;
}

/** Die Farben der Art, nach Körperteil getrennt. */
export interface Farben {
  hut: Farbe[];
  sporenlager: Farbe[];
  stiel: Farbe[];
  fleisch: Farbe[];
  sporenpulver: Farbe[];
  verfaerbung: Verfaerbung | null;
}

/**
 * Von welchem bis zu welchem Monat, beide eingeschlossen. Liegt das Ende vor
 * dem Anfang, läuft die Spanne über den Jahreswechsel.
 */
export interface Monatsspanne {
  vonMonat: number;
  bisMonat: number;
}

/** Der Zeitraum der Quelle, dazu die Spitze, wo die Quelle eine nennt. */
export interface Zeitraum extends Monatsspanne {
  spitzeMonat: number | null;
}

/** Der Schutz nach Bundesartenschutzverordnung. Drei Stufen, kein Schalter. */
export const SCHUTZSTUFEN = ['keiner', 'besondersGeschuetzt', 'strengGeschuetzt'] as const;
export type Schutzstufe = (typeof SCHUTZSTUFEN)[number];

/** Der Schutzstatus mit der Verordnung, aus der er stammt. */
export interface Schutz {
  status: Schutzstufe;
  quelle: string;
}

/**
 * Der Umriss des Hutes. Gezählt über 305 Quellseiten: flach 41, gewölbt 34,
 * trichterförmig 27, halbkugelig 26, kegelig 11, muschelförmig 11, glockig 9,
 * eiförmig 9, kugelig 7, birnenförmig 5, niedergedrückt 3, keulig 2,
 * zylindrisch 2. Was kein Umriss ist, steht als `Hutmerkmal` daneben.
 */
export const HUTFORMEN = [
  'halbkugelig',
  'gewoelbt',
  'flach',
  'niedergedrueckt',
  'trichterfoermig',
  'kegelig',
  'glockig',
  'eifoermig',
  'kugelig',
  'muschelfoermig',
  'birnenfoermig',
  'keulig',
  'zylindrisch',
] as const;
export type Hutform = (typeof HUTFORMEN)[number];

/**
 * Was zu einem Umriss dazukommt: gebuckelt 53, hygrophan 25, gezont 20,
 * vertieft 20, unregelmäßig 13, genabelt 10.
 */
export const HUTMERKMALE = [
  'gebuckelt',
  'hygrophan',
  'gezont',
  'vertieft',
  'unregelmaessig',
  'genabelt',
] as const;
export type Hutmerkmal = (typeof HUTMERKMALE)[number];

/**
 * Der Hutrand: eingerollt 58, wellig 30, gerieft 30, gerissen 28, fransig 19,
 * eingebogen 16, überstehend 13, scharf 12, höckerig 10.
 */
export const HUTRAENDER = [
  'eingerollt',
  'wellig',
  'gerieft',
  'gerissen',
  'fransig',
  'eingebogen',
  'ueberstehend',
  'scharf',
  'hoeckerig',
] as const;
export type Hutrandmerkmal = (typeof HUTRAENDER)[number];

/**
 * Was ein Stiel trägt, mehreres zugleich: Ring 72, Knolle 72, hohl 68,
 * faserig 66, beflockt 57, voll 41, genattert 33, genetzt 25, behaart 17,
 * wurzelnd 16, gerieft 13, Scheide 11, brüchig 10.
 */
export const STIELMERKMALE = [
  'ring',
  'knolle',
  'hohl',
  'faserig',
  'beflockt',
  'voll',
  'genattert',
  'genetzt',
  'behaart',
  'wurzelnd',
  'gerieft',
  'scheide',
  'bruechig',
] as const;
export type Stielmerkmal = (typeof STIELMERKMALE)[number];

/**
 * Ein Merkmal, das sich mit dem Alter ändert. `nach` bleibt leer, wo die
 * Quelle keine Veränderung nennt; dann gilt `von` für das ganze Leben.
 */
export interface Entwicklung<T> {
  von: T;
  nach: T | null;
}

/**
 * Woran die Sporen sitzen. Die Liste kommt aus den Quellseiten: 177 nennen
 * Lamellen, 64 Röhren, 10 Poren, 9 Leisten, 6 Stacheln.
 */
export const FRUCHTSCHICHTEN = ['lamellen', 'roehren', 'poren', 'stacheln', 'leisten'] as const;
export type Fruchtschichtart = (typeof FRUCHTSCHICHTEN)[number];

/** Wie die Lamellen den Stiel treffen. Das trennt den Champignon vom Wulstling. */
export const LAMELLENANSAETZE = ['frei', 'angewachsen', 'ausgebuchtet', 'herablaufend'] as const;
export type Lamellenansatz = (typeof LAMELLENANSAETZE)[number];

/** Wie dicht die Lamellen stehen. */
export const LAMELLENSTAENDE = ['eng', 'normal', 'weit'] as const;
export type Lamellenstand = (typeof LAMELLENSTAENDE)[number];

/** Wie die Schneide einer Lamelle aussieht. */
export const LAMELLENSCHNEIDEN = ['glatt', 'gesaegt', 'bewimpert'] as const;
export type Lamellenschneide = (typeof LAMELLENSCHNEIDEN)[number];

/**
 * Die Fruchtschicht. Ansatz, Stand und Schneide gibt es nur an Lamellen;
 * Röhren, Stacheln und Leisten tragen sie nicht.
 */
export interface Fruchtschicht {
  art: Fruchtschichtart;
  ansatz: Lamellenansatz | null;
  stand: Lamellenstand | null;
  schneide: Lamellenschneide | null;
}

/** Geruch oder Geschmack: Kategorien für den Filter, Satz für den Rest. */
export interface Sinneseindruck {
  tags: string[];
  text: string | null;
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

/**
 * Ob die DGfM die Art auf ihrer Positivliste der Speisepilze führt und ob die
 * Schweiz sie zulässt. Die Quelle gilt für das ganze Profil und steht dort.
 */
export interface Marktfaehigkeit {
  marktfaehig: boolean;
  schweiz: boolean | null;
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

/**
 * Die andere Art eines Verwechslungspaares, aufgelöst.
 *
 * Das Paar steht in genau einer der zwei Profildateien und gilt in beide
 * Richtungen. `unterschied` bleibt leer, wo nur die andere Seite einen Satz
 * dazu trägt; der Name allein ist dann immer noch die Warnung, die zählt.
 *
 * `hutFarben` sind die Hutfarben des Partners. Sie stehen am Paar, weil die
 * Zeile sie als Feld zeigt und fünf Profile für fünf Farbflächen nachzuladen
 * Unsinn wäre.
 */
export interface Confusable {
  slug: string;
  name: string;
  lateinisch: string;
  unterschied: string | null;
  speisewert: Essbarkeit;
  warnung: string | null;
  hutFarben: Farbe[];
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
  schutz: Schutz;
  speisewert: Essbarkeit;
  kartenSlug: string | null;
  /** Ob man die Art sammelt. Ein Verwechslungsprofil steht auf `false`. */
  sammelbar: boolean;
  marktfaehigkeit: Marktfaehigkeit;
  wertigkeit: number | null;
  haeufigkeit: Haeufigkeit | null;
  gefaehrdung: Gefaehrdung | null;
  warnung: string | null;
  jahreszeiten: SeasonOfYear[];
  baeume: Baumart[];
  baeumeAusErfahrung: BaeumeAusErfahrung | null;
  weitereNamen: string[];
  synonyme: string[];
  /** Genug Funde für ein eigenes Modell, aber noch keine Karte. */
  vorhersageGeplant: boolean;
  begehungenMitFund: number;
  spitzeWoche: number | null;
  /** Eine Art ohne Zeile in der Saisontabelle trägt keine Kurve. */
  saison: SeasonCurveBrief | null;
}

/** Eine Art mit Profil, so wie die Artseite sie braucht. */
export interface Species extends Omit<SpeciesBrief, 'saison'> {
  masse: Masse;
  farben: Farben;
  zeitraum: Zeitraum | null;
  /** Die Monate, in denen die Kurve mindestens halb so hoch steht wie im Jahr. */
  beobachteterZeitraum: Monatsspanne | null;
  /** Die Quelle nennt sie nicht bei jeder Art; dann bleibt sie leer. */
  fruchtschicht: Fruchtschicht | null;
  hutform: Entwicklung<Hutform> | null;
  hutmerkmale: Hutmerkmal[];
  hutrand: Entwicklung<Hutrandmerkmal[]> | null;
  stielmerkmale: Stielmerkmal[];
  geruch: Sinneseindruck;
  geschmack: Sinneseindruck;
  quelle: Source;
  merkmale: Feature[];
  reagenzien: Reagenzeintrag[];
  /** Beide Richtungen in einer Liste, denn ein Paar gilt für beide Arten. */
  verwechslungen: Confusable[];
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
