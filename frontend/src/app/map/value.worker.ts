import {
  createCombinationLut,
  createLut,
  colorize,
  combinationIndex,
  combine,
  scaleKey,
  type CombinationBound,
  type ValueScale,
} from './value-colors';
import { TileCache } from './value-cache';
import type { ColorizeJob, CombinationJob, PrefetchJob, ValueReply, ValueJob } from './value-messages';

/** 16 MB rohe Kacheln sind rund 500 Stück, also mehrere Wochen im Blickfeld. */
const CACHE_LIMIT = 16 * 1024 * 1024;

const cache = new TileCache(CACHE_LIMIT);
// Die Tabelle hängt nur an Skala und Rampe; sie wird je Quelle einmal gebaut.
const tables = new Map<string, Uint8ClampedArray>();

// `self` ist im Worker der globale Bereich. Die DOM-Typen kennen dafür nur die
// Signatur des Fensters, darum diese enge Sicht statt eines eigenen Lib-Ziels.
interface WorkerScope {
  postMessage(reply: ValueReply, transfer: Transferable[]): void;
  addEventListener(kind: 'message', handler: (event: MessageEvent<ValueJob>) => void): void;
}

/**
 * Eine entpackte Kachel samt der Leinwand, aus der sie kommt. Das Ergebnis
 * wird in dieselben Punkte geschrieben und auf dieselbe Leinwand gelegt; eine
 * zweite wäre eine viertel Megabyte je Kachel umsonst.
 */
interface Tile {
  shot: ImageData;
  canvas: OffscreenCanvas;
  pen: OffscreenCanvasRenderingContext2D;
}

function table(schluessel: string, create: () => Uint8ClampedArray): Uint8ClampedArray {
  let lut = tables.get(schluessel);
  if (!lut) {
    lut = create();
    tables.set(schluessel, lut);
  }
  return lut;
}

/** Ein Netzfehler ist hier dasselbe wie eine fehlende Kachel: nichts zu zeigen. */
async function get(url: string): Promise<ArrayBuffer | null> {
  const known = cache.get(url);
  if (known !== undefined) return known;
  let content: ArrayBuffer | null = null;
  try {
    const reply = await fetch(url);
    if (reply.ok) content = await reply.arrayBuffer();
  } catch {
    content = null;
  }
  cache.put(url, content);
  return content;
}

/** Holt eine Kachel und packt sie aus. Der rote Kanal trägt das Byte. */
async function unpack(url: string): Promise<Tile | null> {
  const content = await get(url);
  if (content === null || content.byteLength === 0) return null;
  const grey = await createImageBitmap(new Blob([content], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(grey.width, grey.height);
  const pen = canvas.getContext('2d', { willReadFrequently: true });
  if (!pen) return null;
  pen.drawImage(grey, 0, 0);
  grey.close();
  return { shot: pen.getImageData(0, 0, canvas.width, canvas.height), canvas, pen };
}

/** Legt die fertigen Punkte zurück und gibt ein Bild, das MapLibre nimmt. */
function draw(tile: Tile): ImageBitmap {
  tile.pen.putImageData(tile.shot, 0, 0);
  return tile.canvas.transferToImageBitmap();
}

export async function colorizeTile(
  url: string,
  scale: ValueScale,
  colors: readonly string[],
): Promise<ImageBitmap | null> {
  const tile = await unpack(url);
  if (!tile) return null;
  colorize(
    tile.shot.data,
    table(scaleKey(scale, colors), () => createLut(scale, colors)),
  );
  return draw(tile);
}

/**
 * Eine Kachel aus mehreren Quellen. Fehlt eine davon, bleibt die ganze Kachel
 * leer: eine Aussage über eine Schnittmenge braucht jeden Teil.
 */
export async function combineTile(job: CombinationJob): Promise<ImageBitmap | null> {
  const fetched = await Promise.all(job.parts.map((part) => unpack(part.url)));
  const tiles = fetched.filter((tile): tile is Tile => tile !== null);
  const first = tiles[0] as Tile | undefined;
  if (!first || tiles.length !== fetched.length) return null;
  const bounds: CombinationBound[] = job.parts.map((part) => part.bound);
  const lut = table(`kombi|${job.rule}|${job.colors.join(',')}`, () =>
    createCombinationLut(job.colors, job.rule),
  );
  // Das Ergebnis geht in die erste Kachel zurück. Ihre Bytes sind an dieser
  // Stelle schon gelesen, das Überschreiben trifft also niemanden mehr.
  const sources = tiles.map((tile) => tile.shot.data);
  const target = first.shot.data;
  const bytes = new Array<number>(sources.length);
  for (let i = 0; i < target.length; i += 4) {
    for (let part = 0; part < sources.length; part++) bytes[part] = sources[part][i];
    const value = combine(bytes, bounds, job.rule);
    const entry = value < 0 ? 0 : combinationIndex(value) * 4;
    target[i] = lut[entry];
    target[i + 1] = lut[entry + 1];
    target[i + 2] = lut[entry + 2];
    target[i + 3] = lut[entry + 3];
  }
  return draw(first);
}

async function answerJob(range: WorkerScope, job: ColorizeJob | CombinationJob): Promise<void> {
  const shot =
    job.kind === 'faerbe' ? await colorizeTile(job.url, job.scale, job.colors) : await combineTile(job);
  range.postMessage({ id: job.id, shot }, shot ? [shot] : []);
}

/** Die Nachbarwochen liegen danach im Speicher; die Antwort braucht niemand. */
async function load(job: PrefetchJob): Promise<void> {
  for (const url of job.urls) await get(url);
}

export function takeJobs(range: WorkerScope): void {
  range.addEventListener('message', (event) => {
    const job = event.data;
    void (job.kind === 'vorladen' ? load(job) : answerJob(range, job));
  });
}

takeJobs(self as unknown as WorkerScope);
