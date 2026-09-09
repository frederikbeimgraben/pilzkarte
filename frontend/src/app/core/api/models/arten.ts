/**
 * Der Vertrag des Artenkatalogs, wie ihn `backend/app/modules/arten/schemas.py`
 * festlegt. Jedes Enum des Backends steht hier als Liste seiner Werte, aus der
 * der Typ folgt. Ein Tippfehler im Filter oder in einer Beschriftung fällt damit
 * beim Bauen auf und nicht erst in der Oberfläche, und die Liste selbst steht
 * bereit, wo eine Oberfläche die Werte einer Art einordnen muss.
 */

/** Was die App zu einer Art zeigen kann. Die Datenlage entscheidet. */
export const STUFEN = ['vorhersage', 'saison', 'profil'] as const;
export type Stufe = (typeof STUFEN)[number];

/** Die Verwandtschaft, mit der eine Art im Katalog steht. */
export const GRUPPEN = [
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
export type Gruppe = (typeof GRUPPEN)[number];

/** Der Baum, an dem eine Art wächst. Leer bei Zersetzern ohne Wirt. */
export const BAUMARTEN = [
  'fichte',
  'kiefer',
  'tanne',
  'laerche',
  'buche',
  'eiche',
  'birke',
  'hainbuche',
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
export const JAHRESZEITEN = ['fruehling', 'sommer', 'herbst', 'winter'] as const;
export type Jahreszeit = (typeof JAHRESZEITEN)[number];

/** Was mit einer Art in der Pfanne passieren darf. */
export const ESSBARKEITEN = [
  'speisepilz',
  'essbar',
  'bedingtEssbar',
  'ohneSpeisewert',
  'nichtEmpfohlen',
  'ungeniessbar',
  'giftig',
  'toedlichGiftig',
] as const;
export type Essbarkeit = (typeof ESSBARKEITEN)[number];

/** Die Zeilen der Merkmalstabelle, in der Reihenfolge der Artseite. */
export const MERKMAL_SCHLUESSEL = [
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
  'vorkommen',
  'zeit',
  'speisewert',
  'schutz',
] as const;
export type MerkmalSchluessel = (typeof MERKMAL_SCHLUESSEL)[number];

/** Ein Merkmal einer Art, mit dem sich die Liste filtern lässt. */
export type Tag = Stufe | Gruppe | Jahreszeit | Baumart;

/** Eine ISO-Kalenderwoche, so wie sie auf dem Draht steht. */
export interface Woche {
  jahr: number;
  woche: number;
}

/** Von welchem bis zu welchem Jahr eine Reihe zählt, beide eingeschlossen. */
export interface Jahresspanne {
  von: number;
  bis: number;
}

/** Eine Art, die man mit dieser verwechselt, und das trennende Merkmal. */
export interface Verwechslung {
  name: string;
  merkmal: string;
  essbar: Essbarkeit;
}

/** Ein Link nach draußen. Nur die Adresse, kein fremder Text. */
export interface Verweis {
  titel: string;
  url: string;
}

/** Eine Zeile der Merkmalstabelle. */
export interface Merkmal {
  schluessel: MerkmalSchluessel;
  text: string;
}

/** Die Kurve, wie die Artenliste sie klein zeichnet. */
export interface SaisonKurz {
  alleJahre: number[];
  hoechstwert: number;
}

/**
 * Beide Reihen der Saisonkurve, je Kalenderwoche in Prozent. Die zwei
 * `begehungenJeWoche`-Reihen sind der Nenner selbst; die Kurve zeichnet dünne
 * Wochen damit blasser.
 */
export interface SaisonKurve extends SaisonKurz {
  laufendesJahr: number[];
  jahre: Jahresspanne;
  stand: Woche;
  begehungen: number;
  begehungenJeWocheAlleJahre: number[];
  begehungenJeWocheLaufendesJahr: number[];
}

/** Eine Art in der Liste. */
export interface ArtKurz {
  slug: string;
  name: string;
  lateinisch: string;
  gruppe: Gruppe;
  stufe: Stufe;
  tags: Tag[];
  geschuetzt: boolean;
  speisewert: Essbarkeit;
  kartenSlug: string | null;
  begehungenMitFund: number;
  spitzeWoche: number | null;
  saison: SaisonKurz;
}

/** Eine Art mit Profil, so wie die Artseite sie braucht. */
export interface Art extends Omit<ArtKurz, 'saison'> {
  merkmale: Merkmal[];
  verwechslungen: Verwechslung[];
  links: Verweis[];
  saison: SaisonKurve;
}

/**
 * Die Antwort auf `GET /api/arten`. Stand, Jahre und die Begehungen gelten für
 * alle Arten gleich und stehen darum einmal am Kopf statt in jeder Zeile.
 */
export interface ArtenListe {
  stand: Woche;
  jahre: Jahresspanne;
  begehungen: number;
  begehungenJeWocheAlleJahre: number[];
  begehungenJeWocheLaufendesJahr: number[];
  arten: ArtKurz[];
}
