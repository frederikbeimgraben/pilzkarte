import { tilePath } from '../core/tiles/tile-paths';
import { tileKey } from '../core/tiles/manifest';
import { FORECAST_RAMP } from '../ui/ramp/ramp-colors';
import type { CombinationBound, CombinationRule, ValueScale } from './value-colors';
import type { ValueReply, ValueJob } from './value-messages';

/**
 * Nur der Teil eines `Worker`, den das Protokoll benutzt. So kann ein Test eine
 * Attrappe stellen, ohne die ganze Schnittstelle nachzubauen.
 */
export interface ColorizeWorker {
  postMessage(job: ValueJob): void;
  addEventListener(kind: 'message', handler: (event: MessageEvent<ValueReply>) => void): void;
  terminate(): void;
}

/**
 * Eine angemeldete Quelle: was ihre Bytes bedeuten, in welchen Farben sie
 * liegen und welche Kacheln es überhaupt gibt.
 */
export interface ValueSource {
  id: string;
  scale: ValueScale;
  colors: readonly string[];
  existing: ReadonlySet<string>;
}

/** Ein Faktor der Kombination: sein Kachelordner und seine Bedingung. */
export interface CombinationSourcePart {
  folder: string;
  bound: CombinationBound;
  existing: ReadonlySet<string>;
}

/**
 * Eine zusammengesetzte Quelle: mehrere Kacheln je Punkt, eine Antwort. Sie
 * wird bei jeder Änderung neu angemeldet; der Ordner in der Adresse trägt die
 * Kennung der Kombination, damit MapLibre alte Kacheln nicht weiterbenutzt.
 */
export interface CombinationSource {
  id: string;
  rule: CombinationRule;
  colors: readonly string[];
  parts: readonly CombinationSourcePart[];
}

/** Eine leere Antwort. MapLibre macht daraus eine durchsichtige Kachel. */
const EMPTY = new ArrayBuffer(0);

const PATTERN = /^wert:\/\/([^/]+)\/(.+)\/(\d+)\/(\d+)\/(\d+)$/;

/** Die Teile einer `wert://`-Adresse. */
export interface ValueUrl {
  source: string;
  folder: string;
  z: number;
  x: number;
  y: number;
}

/** Die Vorlage für eine Rasterquelle: `wert://<quelle>/<ordner>/{z}/{x}/{y}`. */
export function valueTemplate(source: string, folder: string): string {
  return `wert://${source}/${folder}/{z}/{x}/{y}`;
}

export function parseValueUrl(url: string): ValueUrl | null {
  const matches = PATTERN.exec(url);
  if (!matches) return null;
  return {
    source: matches[1],
    folder: matches[2],
    z: Number(matches[3]),
    x: Number(matches[4]),
    y: Number(matches[5]),
  };
}

/** Die Quelle einer Vorhersage-Art. */
export function speciesSource(slug: string, top: number, existing: ReadonlySet<string>): ValueSource {
  return { id: slug, scale: { art: 'wahrscheinlichkeit', top }, colors: FORECAST_RAMP, existing };
}

/**
 * Das Protokoll `wert://` für MapLibre.
 *
 * Jede Quelle meldet sich einmal an: mit ihrer Skala, ihrer Rampe und der Liste
 * der Kacheln, die Daten tragen. Eine Kachel, die dort fehlt, wird gar nicht
 * erst geholt: sie kommt leer zurück, ohne 404 und ohne Meldung in der Konsole.
 * Alles andere geht an den Worker, der die Bytes holt, färbt und ein fertiges
 * Bild zurückschickt.
 */
export class ValueProtocol {
  private readonly worker: ColorizeWorker;
  private readonly sources = new Map<string, ValueSource>();
  private readonly combinations = new Map<string, CombinationSource>();
  private readonly pending = new Map<number, (shot: ImageBitmap | null) => void>();
  private nextId = 0;

  constructor(createWorker: () => ColorizeWorker) {
    this.worker = createWorker();
    this.worker.addEventListener('message', (event) => {
      const reply = event.data;
      const waiter = this.pending.get(reply.id);
      this.pending.delete(reply.id);
      waiter?.(reply.shot);
    });
  }

  report(source: ValueSource): void {
    this.sources.set(source.id, source);
  }

  reportCombination(source: CombinationSource): void {
    this.combinations.set(source.id, source);
  }

  /** Die Funktion für `maplibregl.addProtocol('wert', …)`. */
  readonly resolve = async (url: string): Promise<{ data: ImageBitmap | ArrayBuffer }> => {
    const adresse = parseValueUrl(url);
    if (!adresse) return { data: EMPTY };
    const combination = this.combinations.get(adresse.source);
    if (combination) return { data: (await this.askCombination(combination, adresse)) ?? EMPTY };
    const source = this.sources.get(adresse.source);
    if (!source?.existing.has(tileKey(adresse.z, adresse.x, adresse.y))) {
      return { data: EMPTY };
    }
    const shot = await this.ask(tilePath(adresse.folder, adresse.z, adresse.x, adresse.y), source);
    return { data: shot ?? EMPTY };
  };

  /**
   * Holt die Kacheln der genannten Ordner in den Speicher des Workers, damit
   * ein Wochenwechsel nicht mehr ins Netz muss.
   */
  prefetch(sourceId: string, folder: readonly string[], tiles: readonly [number, number, number][]): void {
    const source = this.sources.get(sourceId);
    if (!source) return;
    const urls: string[] = [];
    for (const path of folder) {
      for (const [z, x, y] of tiles) {
        if (source.existing.has(tileKey(z, x, y))) urls.push(tilePath(path, z, x, y));
      }
    }
    if (urls.length > 0) this.send({ kind: 'vorladen', urls });
  }

  stop(): void {
    this.worker.terminate();
    this.pending.clear();
  }

  /**
   * Alle Teile müssen die Kachel haben. Fehlt einer, gäbe es an diesem Punkt
   * nichts zu schneiden, und die Kachel bleibt leer.
   */
  private askCombination(source: CombinationSource, adresse: ValueUrl): Promise<ImageBitmap | null> {
    const schluessel = tileKey(adresse.z, adresse.x, adresse.y);
    if (source.parts.length === 0 || !source.parts.every((part) => part.existing.has(schluessel))) {
      return Promise.resolve(null);
    }
    const parts = source.parts.map((part) => ({
      url: tilePath(part.folder, adresse.z, adresse.x, adresse.y),
      bound: part.bound,
    }));
    return this.dispatch((id) => ({
      kind: 'kombi',
      id,
      parts,
      rule: source.rule,
      colors: source.colors,
    }));
  }

  private ask(url: string, source: ValueSource): Promise<ImageBitmap | null> {
    return this.dispatch((id) => ({
      kind: 'faerbe',
      id,
      url,
      scale: source.scale,
      colors: source.colors,
    }));
  }

  private dispatch(create: (id: number) => ValueJob): Promise<ImageBitmap | null> {
    const id = this.nextId++;
    return new Promise<ImageBitmap | null>((done) => {
      this.pending.set(id, done);
      this.send(create(id));
    });
  }

  private send(job: ValueJob): void {
    this.worker.postMessage(job);
  }
}
