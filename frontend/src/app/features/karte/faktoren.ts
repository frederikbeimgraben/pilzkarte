import { formatiereWert, formatiereZahl, type Ebene } from '../../core/kacheln/ebenen';
import { RAND_ANTEIL, type KombiGrenze } from '../../map/wert-farben';

/** Die drei Formen einer Bedingung. Alle drei sind eine Spanne über der Skala. */
export type Bedingung = 'unter' | 'ueber' | 'zwischen';

/**
 * Ein Faktor der Kombination: eine Quelle mit einer Bedingung.
 *
 * `von` und `bis` stehen in der Einheit der Quelle. Bei „unter“ zählt nur
 * `bis`, bei „über“ nur `von`; die andere Grenze kommt von der Skala.
 */
export interface Faktor {
  quelle: string;
  bedingung: Bedingung;
  von: number;
  bis: number;
  aktiv: boolean;
}

/**
 * Die vier Faktoren, mit denen die Kombination aufgeht: das Beispiel aus dem
 * Konzept und dem Artboard `Kombination`.
 */
export const STANDARD_FAKTOREN: readonly Faktor[] = [
  { quelle: 'regen_4w', bedingung: 'ueber', von: 80, bis: 0, aktiv: true },
  { quelle: 'temperatur', bedingung: 'zwischen', von: 8, bis: 16, aktiv: true },
  { quelle: 'buche', bedingung: 'ueber', von: 0.3, bis: 0, aktiv: true },
  { quelle: 'hangneigung', bedingung: 'unter', von: 0, bis: 15, aktiv: true },
];

/** Kurzform der Bedingung in der Adresse. */
const KUERZEL: Record<Bedingung, string> = { unter: 'le', ueber: 'ge', zwischen: 'zw' };

const AUS_KUERZEL: Record<string, Bedingung> = { le: 'unter', ge: 'ueber', zw: 'zwischen' };

const QUELLE_MUSTER = /^[a-z0-9_]{1,40}$/;

/**
 * Die Kombination als ein Wert der Adresse:
 * `regen_4w:ge:80,temperatur:zw:8:16,buche:ge:0.3`. Ein abgehakter Faktor
 * trägt ein Ausrufezeichen vorn, damit er beim Teilen nicht verloren geht.
 */
export function kodiereFaktoren(faktoren: readonly Faktor[]): string {
  return faktoren.map(kodiereFaktor).join(',');
}

function kodiereFaktor(faktor: Faktor): string {
  const kopf = `${faktor.aktiv ? '' : '!'}${faktor.quelle}:${KUERZEL[faktor.bedingung]}`;
  if (faktor.bedingung === 'zwischen') return `${kopf}:${zahlText(faktor.von)}:${zahlText(faktor.bis)}`;
  return `${kopf}:${zahlText(faktor.bedingung === 'unter' ? faktor.bis : faktor.von)}`;
}

/** Ohne Nachkommastellen, wo keine nötig sind: `0.3`, aber `80`. */
function zahlText(wert: number): string {
  return String(Math.round(wert * 1000) / 1000);
}

export function leseFaktoren(text: string | null): Faktor[] {
  if (text === null || text === '') return [];
  return text
    .split(',')
    .map(leseFaktor)
    .filter((faktor): faktor is Faktor => faktor !== null);
}

function leseFaktor(text: string): Faktor | null {
  const teile = text.split(':');
  const aktiv = !teile[0].startsWith('!');
  const quelle = aktiv ? teile[0] : teile[0].slice(1);
  const bedingung = AUS_KUERZEL[teile[1]] as Bedingung | undefined;
  if (!QUELLE_MUSTER.test(quelle) || !bedingung) return null;
  const erste = Number(teile[2]);
  const zweite = Number(teile[3]);
  if (!Number.isFinite(erste)) return null;
  if (bedingung === 'zwischen') {
    if (!Number.isFinite(zweite)) return null;
    return { quelle, bedingung, von: Math.min(erste, zweite), bis: Math.max(erste, zweite), aktiv };
  }
  return {
    quelle,
    bedingung,
    von: bedingung === 'ueber' ? erste : 0,
    bis: bedingung === 'unter' ? erste : 0,
    aktiv,
  };
}

/** Die Bedingung als Spanne über der Skala der Quelle, in ihrer Einheit. */
export function spanne(faktor: Faktor, ebene: Ebene): { von: number; bis: number } {
  if (faktor.bedingung === 'unter') return { von: ebene.low, bis: faktor.bis };
  if (faktor.bedingung === 'ueber') return { von: faktor.von, bis: ebene.high };
  return { von: faktor.von, bis: faktor.bis };
}

/** Die Bedingung in Worten: `≥ 80 mm`, `≤ 15 Grad`, `8 bis 16 Grad`. */
export function bedingungText(faktor: Faktor, ebene: Ebene, locale: string, bis: string): string {
  if (faktor.bedingung === 'unter') return `≤ ${formatiereWert(faktor.bis, ebene, locale)}`;
  if (faktor.bedingung === 'ueber') return `≥ ${formatiereWert(faktor.von, ebene, locale)}`;
  // Die Einheit steht einmal, am Ende: „8 bis 16 Grad“, nicht zweimal.
  const links = formatiereZahl(faktor.von, ebene, locale);
  return `${links} ${bis} ${formatiereWert(faktor.bis, ebene, locale)}`;
}

/**
 * Der Wert als Byte der Wertkachel. Byte 0 heißt „keine Daten“, die Skala
 * beginnt darum bei 1.
 */
export function byteFuerWert(ebene: Ebene, wert: number): number {
  const breite = ebene.high - ebene.low;
  const relativ = breite === 0 ? 0 : (wert - ebene.low) / breite;
  return Math.min(255, Math.max(1, Math.round(1 + relativ * 254)));
}

/** Die Bedingung, wie der Worker sie braucht: in Bytes, mit Randbreite. */
export function grenzeFuer(faktor: Faktor, ebene: Ebene): KombiGrenze {
  const werte = spanne(faktor, ebene);
  return {
    von: byteFuerWert(ebene, werte.von),
    bis: byteFuerWert(ebene, werte.bis),
    rand: Math.round(254 * RAND_ANTEIL),
  };
}

/** Ein Faktor je Quelle: derselbe Wert zweimal zu prüfen hilft niemandem. */
export function ersetzeFaktor(faktoren: readonly Faktor[], neu: Faktor): Faktor[] {
  const stelle = faktoren.findIndex((faktor) => faktor.quelle === neu.quelle);
  if (stelle < 0) return [...faktoren, neu];
  return faktoren.map((faktor, i) => (i === stelle ? neu : faktor));
}

/**
 * Eine kurze Kennung der Kombination. Sie steht im Ordner der Adresse, damit
 * MapLibre die Kacheln einer alten Kombination nicht weiterbenutzt.
 */
export function kombiSchluessel(teile: readonly string[]): string {
  let hash = 5381;
  const text = teile.join('|');
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
