import { kachelPfad } from '../core/kacheln/kachel-pfade';
import { kachelSchluessel } from '../core/kacheln/manifest';
import { VORHERSAGE_RAMPE } from '../ui/ramp/rampe-farben';
import type { KombiGrenze, KombiRegel, WertSkala } from './wert-farben';
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

/**
 * Eine angemeldete Quelle: was ihre Bytes bedeuten, in welchen Farben sie
 * liegen und welche Kacheln es überhaupt gibt.
 */
export interface WertQuelle {
  id: string;
  skala: WertSkala;
  farben: readonly string[];
  vorhanden: ReadonlySet<string>;
}

/** Ein Faktor der Kombination: sein Kachelordner und seine Bedingung. */
export interface KombiQuellenTeil {
  ordner: string;
  grenze: KombiGrenze;
  vorhanden: ReadonlySet<string>;
}

/**
 * Eine zusammengesetzte Quelle: mehrere Kacheln je Punkt, eine Antwort. Sie
 * wird bei jeder Änderung neu angemeldet; der Ordner in der Adresse trägt die
 * Kennung der Kombination, damit MapLibre alte Kacheln nicht weiterbenutzt.
 */
export interface KombiQuelle {
  id: string;
  regel: KombiRegel;
  farben: readonly string[];
  teile: readonly KombiQuellenTeil[];
}

/** Eine leere Antwort. MapLibre macht daraus eine durchsichtige Kachel. */
const LEER = new ArrayBuffer(0);

const MUSTER = /^wert:\/\/([^/]+)\/(.+)\/(\d+)\/(\d+)\/(\d+)$/;

/** Die Teile einer `wert://`-Adresse. */
export interface WertAdresse {
  quelle: string;
  ordner: string;
  z: number;
  x: number;
  y: number;
}

/** Die Vorlage für eine Rasterquelle: `wert://<quelle>/<ordner>/{z}/{x}/{y}`. */
export function wertVorlage(quelle: string, ordner: string): string {
  return `wert://${quelle}/${ordner}/{z}/{x}/{y}`;
}

export function zerlegeWertUrl(url: string): WertAdresse | null {
  const treffer = MUSTER.exec(url);
  if (!treffer) return null;
  return {
    quelle: treffer[1],
    ordner: treffer[2],
    z: Number(treffer[3]),
    x: Number(treffer[4]),
    y: Number(treffer[5]),
  };
}

/** Die Quelle einer Vorhersage-Art. */
export function artQuelle(slug: string, top: number, vorhanden: ReadonlySet<string>): WertQuelle {
  return { id: slug, skala: { art: 'wahrscheinlichkeit', top }, farben: VORHERSAGE_RAMPE, vorhanden };
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
export class WertProtokoll {
  private readonly arbeiter: FaerbeArbeiter;
  private readonly quellen = new Map<string, WertQuelle>();
  private readonly kombis = new Map<string, KombiQuelle>();
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

  melde(quelle: WertQuelle): void {
    this.quellen.set(quelle.id, quelle);
  }

  meldeKombi(quelle: KombiQuelle): void {
    this.kombis.set(quelle.id, quelle);
  }

  /** Die Funktion für `maplibregl.addProtocol('wert', …)`. */
  readonly aufloesen = async (url: string): Promise<{ data: ImageBitmap | ArrayBuffer }> => {
    const adresse = zerlegeWertUrl(url);
    if (!adresse) return { data: LEER };
    const kombi = this.kombis.get(adresse.quelle);
    if (kombi) return { data: (await this.frageKombi(kombi, adresse)) ?? LEER };
    const quelle = this.quellen.get(adresse.quelle);
    if (!quelle?.vorhanden.has(kachelSchluessel(adresse.z, adresse.x, adresse.y))) {
      return { data: LEER };
    }
    const bild = await this.frage(kachelPfad(adresse.ordner, adresse.z, adresse.x, adresse.y), quelle);
    return { data: bild ?? LEER };
  };

  /**
   * Holt die Kacheln der genannten Ordner in den Speicher des Workers, damit
   * ein Wochenwechsel nicht mehr ins Netz muss.
   */
  vorladen(quelleId: string, ordner: readonly string[], kacheln: readonly [number, number, number][]): void {
    const quelle = this.quellen.get(quelleId);
    if (!quelle) return;
    const urls: string[] = [];
    for (const pfad of ordner) {
      for (const [z, x, y] of kacheln) {
        if (quelle.vorhanden.has(kachelSchluessel(z, x, y))) urls.push(kachelPfad(pfad, z, x, y));
      }
    }
    if (urls.length > 0) this.sende({ typ: 'vorladen', urls });
  }

  beende(): void {
    this.arbeiter.terminate();
    this.offen.clear();
  }

  /**
   * Alle Teile müssen die Kachel haben. Fehlt einer, gäbe es an diesem Punkt
   * nichts zu schneiden, und die Kachel bleibt leer.
   */
  private frageKombi(quelle: KombiQuelle, adresse: WertAdresse): Promise<ImageBitmap | null> {
    const schluessel = kachelSchluessel(adresse.z, adresse.x, adresse.y);
    if (quelle.teile.length === 0 || !quelle.teile.every((teil) => teil.vorhanden.has(schluessel))) {
      return Promise.resolve(null);
    }
    const teile = quelle.teile.map((teil) => ({
      url: kachelPfad(teil.ordner, adresse.z, adresse.x, adresse.y),
      grenze: teil.grenze,
    }));
    return this.beauftrage((id) => ({
      typ: 'kombi',
      id,
      teile,
      regel: quelle.regel,
      farben: quelle.farben,
    }));
  }

  private frage(url: string, quelle: WertQuelle): Promise<ImageBitmap | null> {
    return this.beauftrage((id) => ({
      typ: 'faerbe',
      id,
      url,
      skala: quelle.skala,
      farben: quelle.farben,
    }));
  }

  private beauftrage(baue: (id: number) => WertAuftrag): Promise<ImageBitmap | null> {
    const id = this.naechsteId++;
    return new Promise<ImageBitmap | null>((fertig) => {
      this.offen.set(id, fertig);
      this.sende(baue(id));
    });
  }

  private sende(auftrag: WertAuftrag): void {
    this.arbeiter.postMessage(auftrag);
  }
}
