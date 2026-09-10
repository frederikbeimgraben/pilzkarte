import { baueLut, faerbe } from './wert-farben';
import { KachelSpeicher } from './wert-speicher';
import type { FaerbeAuftrag, VorladeAuftrag, WertAntwort, WertAuftrag } from './wert-nachrichten';

/** 16 MB rohe Kacheln sind rund 500 Stück, also mehrere Wochen im Blickfeld. */
const SPEICHER_GRENZE = 16 * 1024 * 1024;

const speicher = new KachelSpeicher(SPEICHER_GRENZE);
// Die Tabelle hängt nur am Höchstwert der Art; sie wird je Art einmal gebaut.
const tabellen = new Map<number, Uint8ClampedArray>();

// `self` ist im Worker der globale Bereich. Die DOM-Typen kennen dafür nur die
// Signatur des Fensters, darum diese enge Sicht statt eines eigenen Lib-Ziels.
interface WorkerBereich {
  postMessage(antwort: WertAntwort, transfer: Transferable[]): void;
  addEventListener(typ: 'message', hoerer: (ereignis: MessageEvent<WertAuftrag>) => void): void;
}

function tabelle(top: number): Uint8ClampedArray {
  let lut = tabellen.get(top);
  if (!lut) {
    lut = baueLut(top);
    tabellen.set(top, lut);
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

export async function faerbeKachel(url: string, top: number): Promise<ImageBitmap | null> {
  const inhalt = await hole(url);
  if (inhalt === null || inhalt.byteLength === 0) return null;
  const grau = await createImageBitmap(new Blob([inhalt], { type: 'image/png' }));
  const leinwand = new OffscreenCanvas(grau.width, grau.height);
  const stift = leinwand.getContext('2d', { willReadFrequently: true });
  if (!stift) return null;
  stift.drawImage(grau, 0, 0);
  grau.close();
  const punkte = stift.getImageData(0, 0, leinwand.width, leinwand.height);
  faerbe(punkte.data, tabelle(top));
  stift.putImageData(punkte, 0, 0);
  return leinwand.transferToImageBitmap();
}

async function beantworte(bereich: WorkerBereich, auftrag: FaerbeAuftrag): Promise<void> {
  const bild = await faerbeKachel(auftrag.url, auftrag.top);
  bereich.postMessage({ id: auftrag.id, bild }, bild ? [bild] : []);
}

/** Die Nachbarwochen liegen danach im Speicher; die Antwort braucht niemand. */
async function lade(auftrag: VorladeAuftrag): Promise<void> {
  for (const url of auftrag.urls) await hole(url);
}

export function nimmAuftraege(bereich: WorkerBereich): void {
  bereich.addEventListener('message', (ereignis) => {
    const auftrag = ereignis.data;
    void (auftrag.typ === 'faerbe' ? beantworte(bereich, auftrag) : lade(auftrag));
  });
}

nimmAuftraege(self as unknown as WorkerBereich);
