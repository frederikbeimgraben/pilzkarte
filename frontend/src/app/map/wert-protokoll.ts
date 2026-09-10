import { kachelPfad } from '../core/kacheln/kachel-pfade';
import { kachelSchluessel, type ArtManifest } from '../core/kacheln/manifest';
import type { WertAntwort, WertAuftrag } from './wert-nachrichten';

/**
 * Nur der Teil eines `Worker`, den das Protokoll benutzt. So kann ein Test eine
 * Attrappe stellen, ohne die ganze Schnittstelle nachzubauen.
 */
export interface FaerbeArbeiter {
  postMessage(auftrag: WertAuftrag): void;
  addEventListener(typ: 'message', hoerer: (ereignis: MessageEvent<WertAntwort>) => void): void;
  terminate(): void;
}

/** Eine leere Antwort. MapLibre macht daraus eine durchsichtige Kachel. */
const LEER = new ArrayBuffer(0);

const MUSTER = /^wert:\/\/([^/]+)\/(.+)\/(\d+)\/(\d+)\/(\d+)$/;

/** Die Teile einer `wert://`-Adresse. */
export interface WertAdresse {
  slug: string;
  wochenOrdner: string;
  z: number;
  x: number;
  y: number;
}

/** Die Vorlage für eine Rasterquelle: `wert://<art>/<wochenordner>/{z}/{x}/{y}`. */
export function wertVorlage(slug: string, wochenOrdner: string): string {
  return `wert://${slug}/${wochenOrdner}/{z}/{x}/{y}`;
}

export function zerlegeWertUrl(url: string): WertAdresse | null {
  const treffer = MUSTER.exec(url);
  if (!treffer) return null;
  return {
    slug: treffer[1],
    wochenOrdner: treffer[2],
    z: Number(treffer[3]),
    x: Number(treffer[4]),
    y: Number(treffer[5]),
  };
}

/**
 * Das Protokoll `wert://` für MapLibre.
 *
 * Es kennt je Art den Höchstwert und die Liste der Kacheln mit Daten. Eine
 * Kachel, die es nicht gibt, wird gar nicht erst geholt: sie kommt leer zurück,
 * ohne 404 und ohne Meldung in der Konsole. Alles andere geht an den Worker,
 * der die Bytes holt, färbt und ein fertiges Bild zurückschickt.
 */
export class WertProtokoll {
  private readonly arbeiter: FaerbeArbeiter;
  private readonly arten = new Map<string, ArtManifest>();
  private readonly offen = new Map<number, (bild: ImageBitmap | null) => void>();
  private naechsteId = 0;

  constructor(baueArbeiter: () => FaerbeArbeiter) {
    this.arbeiter = baueArbeiter();
    this.arbeiter.addEventListener('message', (ereignis) => {
      const antwort = ereignis.data;
      const warte = this.offen.get(antwort.id);
      this.offen.delete(antwort.id);
      warte?.(antwort.bild);
    });
  }

  merkeArt(manifest: ArtManifest): void {
    this.arten.set(manifest.slug, manifest);
  }

  /** Die Funktion für `maplibregl.addProtocol('wert', …)`. */
  readonly aufloesen = async (url: string): Promise<{ data: ImageBitmap | ArrayBuffer }> => {
    const adresse = zerlegeWertUrl(url);
    const art = adresse ? this.arten.get(adresse.slug) : undefined;
    if (!adresse || !art?.vorhanden.has(kachelSchluessel(adresse.z, adresse.x, adresse.y))) {
      return { data: LEER };
    }
    const bild = await this.frage(kachelPfad(adresse.wochenOrdner, adresse.z, adresse.x, adresse.y), art.top);
    return { data: bild ?? LEER };
  };

  /**
   * Holt die Kacheln der genannten Wochen in den Speicher des Workers, damit
   * ein Wochenwechsel nicht mehr ins Netz muss.
   */
  vorladen(
    slug: string,
    wochenOrdner: readonly string[],
    kacheln: readonly [number, number, number][],
  ): void {
    const art = this.arten.get(slug);
    if (!art) return;
    const urls: string[] = [];
    for (const ordner of wochenOrdner) {
      for (const [z, x, y] of kacheln) {
        if (art.vorhanden.has(kachelSchluessel(z, x, y))) urls.push(kachelPfad(ordner, z, x, y));
      }
    }
    if (urls.length > 0) this.sende({ typ: 'vorladen', urls });
  }

  beende(): void {
    this.arbeiter.terminate();
    this.offen.clear();
  }

  private frage(url: string, top: number): Promise<ImageBitmap | null> {
    const id = this.naechsteId++;
    return new Promise<ImageBitmap | null>((fertig) => {
      this.offen.set(id, fertig);
      this.sende({ typ: 'faerbe', id, url, top });
    });
  }

  private sende(auftrag: WertAuftrag): void {
    this.arbeiter.postMessage(auftrag);
  }
}
