import {
  baueKombiLut,
  baueLut,
  faerbe,
  kombiIndex,
  kombiniere,
  skalenSchluessel,
  type KombiGrenze,
  type WertSkala,
} from './wert-farben';
import { KachelSpeicher } from './wert-speicher';
import type {
  FaerbeAuftrag,
  KombiAuftrag,
  VorladeAuftrag,
  WertAntwort,
  WertAuftrag,
} from './wert-nachrichten';

/** 16 MB rohe Kacheln sind rund 500 Stück, also mehrere Wochen im Blickfeld. */
const SPEICHER_GRENZE = 16 * 1024 * 1024;

const speicher = new KachelSpeicher(SPEICHER_GRENZE);
// Die Tabelle hängt nur an Skala und Rampe; sie wird je Quelle einmal gebaut.
const tabellen = new Map<string, Uint8ClampedArray>();

// `self` ist im Worker der globale Bereich. Die DOM-Typen kennen dafür nur die
// Signatur des Fensters, darum diese enge Sicht statt eines eigenen Lib-Ziels.
interface WorkerBereich {
  postMessage(antwort: WertAntwort, transfer: Transferable[]): void;
  addEventListener(typ: 'message', hoerer: (ereignis: MessageEvent<WertAuftrag>) => void): void;
}

/**
 * Eine entpackte Kachel samt der Leinwand, aus der sie kommt. Das Ergebnis
 * wird in dieselben Punkte geschrieben und auf dieselbe Leinwand gelegt; eine
 * zweite wäre eine viertel Megabyte je Kachel umsonst.
 */
interface Kachel {
  bild: ImageData;
  leinwand: OffscreenCanvas;
  stift: OffscreenCanvasRenderingContext2D;
}

function tabelle(schluessel: string, baue: () => Uint8ClampedArray): Uint8ClampedArray {
  let lut = tabellen.get(schluessel);
  if (!lut) {
    lut = baue();
    tabellen.set(schluessel, lut);
  }
  return lut;
}

/** Ein Netzfehler ist hier dasselbe wie eine fehlende Kachel: nichts zu zeigen. */
async function hole(url: string): Promise<ArrayBuffer | null> {
  const bekannt = speicher.hole(url);
  if (bekannt !== undefined) return bekannt;
  let inhalt: ArrayBuffer | null = null;
  try {
    const antwort = await fetch(url);
    if (antwort.ok) inhalt = await antwort.arrayBuffer();
  } catch {
    inhalt = null;
  }
  speicher.lege(url, inhalt);
  return inhalt;
}

/** Holt eine Kachel und packt sie aus. Der rote Kanal trägt das Byte. */
async function entpacke(url: string): Promise<Kachel | null> {
  const inhalt = await hole(url);
  if (inhalt === null || inhalt.byteLength === 0) return null;
  const grau = await createImageBitmap(new Blob([inhalt], { type: 'image/png' }));
  const leinwand = new OffscreenCanvas(grau.width, grau.height);
  const stift = leinwand.getContext('2d', { willReadFrequently: true });
  if (!stift) return null;
  stift.drawImage(grau, 0, 0);
  grau.close();
  return { bild: stift.getImageData(0, 0, leinwand.width, leinwand.height), leinwand, stift };
}

/** Legt die fertigen Punkte zurück und gibt ein Bild, das MapLibre nimmt. */
function zeichne(kachel: Kachel): ImageBitmap {
  kachel.stift.putImageData(kachel.bild, 0, 0);
  return kachel.leinwand.transferToImageBitmap();
}

export async function faerbeKachel(
  url: string,
  skala: WertSkala,
  farben: readonly string[],
): Promise<ImageBitmap | null> {
  const kachel = await entpacke(url);
  if (!kachel) return null;
  faerbe(
    kachel.bild.data,
    tabelle(skalenSchluessel(skala, farben), () => baueLut(skala, farben)),
  );
  return zeichne(kachel);
}

/**
 * Eine Kachel aus mehreren Quellen. Fehlt eine davon, bleibt die ganze Kachel
 * leer: eine Aussage über eine Schnittmenge braucht jeden Teil.
 */
export async function kombiniereKachel(auftrag: KombiAuftrag): Promise<ImageBitmap | null> {
  const geholt = await Promise.all(auftrag.teile.map((teil) => entpacke(teil.url)));
  const kacheln = geholt.filter((kachel): kachel is Kachel => kachel !== null);
  const erste = kacheln[0] as Kachel | undefined;
  if (!erste || kacheln.length !== geholt.length) return null;
  const grenzen: KombiGrenze[] = auftrag.teile.map((teil) => teil.grenze);
  const lut = tabelle(`kombi|${auftrag.regel}|${auftrag.farben.join(',')}`, () =>
    baueKombiLut(auftrag.farben, auftrag.regel),
  );
  // Das Ergebnis geht in die erste Kachel zurück. Ihre Bytes sind an dieser
  // Stelle schon gelesen, das Überschreiben trifft also niemanden mehr.
  const quellen = kacheln.map((kachel) => kachel.bild.data);
  const ziel = erste.bild.data;
  const bytes = new Array<number>(quellen.length);
  for (let i = 0; i < ziel.length; i += 4) {
    for (let teil = 0; teil < quellen.length; teil++) bytes[teil] = quellen[teil][i];
    const wert = kombiniere(bytes, grenzen, auftrag.regel);
    const eintrag = wert < 0 ? 0 : kombiIndex(wert) * 4;
    ziel[i] = lut[eintrag];
    ziel[i + 1] = lut[eintrag + 1];
    ziel[i + 2] = lut[eintrag + 2];
    ziel[i + 3] = lut[eintrag + 3];
  }
  return zeichne(erste);
}

async function beantworte(bereich: WorkerBereich, auftrag: FaerbeAuftrag | KombiAuftrag): Promise<void> {
  const bild =
    auftrag.typ === 'faerbe'
      ? await faerbeKachel(auftrag.url, auftrag.skala, auftrag.farben)
      : await kombiniereKachel(auftrag);
  bereich.postMessage({ id: auftrag.id, bild }, bild ? [bild] : []);
}

/** Die Nachbarwochen liegen danach im Speicher; die Antwort braucht niemand. */
async function lade(auftrag: VorladeAuftrag): Promise<void> {
  for (const url of auftrag.urls) await hole(url);
}

export function nimmAuftraege(bereich: WorkerBereich): void {
  bereich.addEventListener('message', (ereignis) => {
    const auftrag = ereignis.data;
    void (auftrag.typ === 'vorladen' ? lade(auftrag) : beantworte(bereich, auftrag));
  });
}

nimmAuftraege(self as unknown as WorkerBereich);
