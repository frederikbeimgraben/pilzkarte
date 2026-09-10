import type { Map as MapLibreKarte, MapSourceDataEvent } from 'maplibre-gl';
import type { Ausschnitt } from './kachel-raster';

/** Nur der Teil von MapLibre, den der Adapter braucht. */
export type MaplibreModul = Pick<
  typeof import('maplibre-gl'),
  'Map' | 'AttributionControl' | 'addProtocol' | 'removeProtocol'
>;

/** Südwest- und Nordostecke als [Länge, Breite]. */
export type Grenzen = readonly [readonly [number, number], readonly [number, number]];

/** Der freie Streifen der Karte: was Blatt, Navigation und Kopf verdecken. */
export interface Polster {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Ein eigenes Protokoll, das MapLibre kennen muss, bevor die erste Kachel fällt. */
export interface Protokoll {
  name: string;
  aufloesen: (url: string) => Promise<{ data: ImageBitmap | ArrayBuffer }>;
}

export interface KartenOptionen {
  stil: string;
  zentrum: readonly [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  maxGrenzen: Grenzen;
  protokoll: Protokoll;
}

/**
 * Was die Kartenseite von der Karte braucht. Die Seite kennt MapLibre nicht;
 * so bleibt sie ohne WebGL testbar.
 */
export interface MapAdapter {
  /** Holt MapLibre schon, bevor die Karte gebraucht wird. */
  waermeAuf(): void;
  starte(wirt: HTMLElement, optionen: KartenOptionen): Promise<void>;
  setzeStil(stil: string): void;
  /** Legt die Wertkacheln einer Woche auf die Karte, ohne Flackern. */
  zeigeWert(vorlage: string, grenzen: Grenzen, zoomVon: number, zoomBis: number): void;
  passeEin(grenzen: Grenzen, polster: Polster): void;
  setzePolster(polster: Polster): void;
  ausschnitt(): { zoom: number; ausschnitt: Ausschnitt } | null;
  beiBewegung(hoerer: () => void): void;
  zerstoere(): void;
}

const QUELLEN = ['wert-a', 'wert-b'] as const;

/** Nach dieser Zeit wird die neue Woche auch ohne alle Kacheln sichtbar. */
const TAUSCH_FRIST = 1500;

/**
 * MapLibre hinter der Schnittstelle.
 *
 * Der Wochenwechsel läuft über zwei Rasterquellen im Wechsel: die neue Woche
 * wird unsichtbar geladen und erst sichtbar geschaltet, wenn ihre Kacheln da
 * sind. Ein Tausch an einer Quelle würde die Karte kurz leer zeigen.
 */
export class MapLibreAdapter implements MapAdapter {
  private modul: MaplibreModul | null = null;
  private protokollName: string | null = null;
  private karte: MapLibreKarte | null = null;
  private aktiv = 0;
  private vorlage: string | null = null;
  private tausch: (() => void) | null = null;
  private wertRaum: { grenzen: Grenzen; zoomVon: number; zoomBis: number } | null = null;

  constructor(private readonly lade: () => Promise<MaplibreModul>) {}

  waermeAuf(): void {
    // Der Modullader gibt beim zweiten Aufruf dasselbe Versprechen zurück; ein
    // früher Anstoß kostet darum nichts und spart den Weg über den ersten Rahmen.
    void this.lade();
  }

  async starte(wirt: HTMLElement, optionen: KartenOptionen): Promise<void> {
    const modul = await this.lade();
    this.modul = modul;
    // Das Protokoll steht vor der Karte, sonst fiele die erste Kachel ins Leere.
    modul.addProtocol(optionen.protokoll.name, (anfrage) => optionen.protokoll.aufloesen(anfrage.url));
    this.protokollName = optionen.protokoll.name;
    this.karte = new modul.Map({
      container: wirt,
      style: optionen.stil,
      center: [optionen.zentrum[0], optionen.zentrum[1]],
      zoom: optionen.zoom,
      minZoom: optionen.minZoom,
      maxZoom: optionen.maxZoom,
      maxBounds: optionen.maxGrenzen as [[number, number], [number, number]],
      // Der Hinweis steht oben rechts, nicht wie sonst unten: unten liegt das
      // Blatt darüber, und ein verdeckter Hinweis wäre keiner. Den Text liefert
      // der Stil von OpenFreeMap selbst; ein zweiter eigener stünde doppelt da.
      attributionControl: false,
    });
    this.karte.addControl(new modul.AttributionControl({ compact: true }), 'top-right');
    // Eine Quelle vor dem Stil wirft. `style.load` ist das erste Ereignis, nach
    // dem der Stil steht; `load` wartet zusätzlich auf jede Kachel und bleibt
    // über einer langsamen Leitung lange aus.
    await new Promise<void>((fertig) => {
      this.karte?.once('style.load', () => {
        fertig();
      });
    });
  }

  setzeStil(stil: string): void {
    const karte = this.karte;
    if (!karte) return;
    karte.setStyle(stil);
    // Ein neuer Stil wirft alle eigenen Quellen weg. Sie kommen zurück, sobald
    // der Stil steht, sonst wäre die Vorhersage nach dem Themenwechsel fort.
    karte.once('style.load', () => {
      this.aktiv = 0;
      const vorlage = this.vorlage;
      this.vorlage = null;
      if (vorlage && this.wertRaum) {
        this.zeigeWert(vorlage, this.wertRaum.grenzen, this.wertRaum.zoomVon, this.wertRaum.zoomBis);
      }
    });
  }

  zeigeWert(vorlage: string, grenzen: Grenzen, zoomVon: number, zoomBis: number): void {
    const karte = this.karte;
    if (!karte || vorlage === this.vorlage) return;
    this.vorlage = vorlage;
    this.wertRaum = { grenzen, zoomVon, zoomBis };
    // Ein noch offener Tausch wird zuerst zu Ende gebracht, sonst lägen drei
    // Wochen übereinander und keine wäre sichtbar.
    this.schliesseTausch();
    const alt = QUELLEN[this.aktiv];
    const neu = QUELLEN[1 - this.aktiv];
    this.entferne(neu);
    karte.addSource(neu, {
      type: 'raster',
      tiles: [vorlage],
      tileSize: 256,
      minzoom: zoomVon,
      maxzoom: zoomBis,
      bounds: [grenzen[0][0], grenzen[0][1], grenzen[1][0], grenzen[1][1]],
      attribution: '',
    });
    karte.addLayer({
      id: neu,
      type: 'raster',
      source: neu,
      paint: {
        'raster-opacity': karte.getLayer(alt) ? 0 : 1,
        // Ohne diese beiden Nullen blendet MapLibre über 300 ms ein. Die alte
        // Woche ist da schon weg, und dazwischen bliebe die Karte leer.
        'raster-opacity-transition': { duration: 0, delay: 0 },
        'raster-fade-duration': 0,
      },
    });
    this.aktiv = 1 - this.aktiv;
    if (!karte.getLayer(alt)) return;
    this.tauscheNachLaden(karte, alt, neu);
  }

  /**
   * Blendet die neue Woche ein, sobald ihre Kacheln liegen, und nimmt die alte
   * weg. Die Frist ist die Notbremse: fehlt eine Kachel dauerhaft, bliebe die
   * neue Woche sonst für immer unsichtbar.
   */
  private tauscheNachLaden(karte: MapLibreKarte, alt: string, neu: string): void {
    const fertig = (): void => {
      clearTimeout(frist);
      karte.off('sourcedata', beiDaten);
      this.tausch = null;
      karte.setPaintProperty(neu, 'raster-opacity', 1);
      this.entferne(alt);
    };
    const beiDaten = (ereignis: MapSourceDataEvent): void => {
      // Die Meldungen zur Quelle selbst („Beschreibung gelesen“, „sichtbar
      // geschaltet“) kommen, bevor die erste Kachel angefragt ist. Auf sie zu
      // hören hieße, die alte Woche vor der neuen wegzunehmen.
      if (ereignis.sourceId !== neu) return;
      if (ereignis.sourceDataType === 'metadata' || ereignis.sourceDataType === 'visibility') return;
      if (ereignis.isSourceLoaded) fertig();
    };
    const frist = setTimeout(fertig, TAUSCH_FRIST);
    this.tausch = fertig;
    karte.on('sourcedata', beiDaten);
  }

  private schliesseTausch(): void {
    const tausch = this.tausch;
    this.tausch = null;
    tausch?.();
  }

  passeEin(grenzen: Grenzen, polster: Polster): void {
    const karte = this.karte;
    if (!karte) return;
    // Das Polster gehört an die Karte, nicht an den Aufruf: `fitBounds` zöge es
    // sonst zweimal ab, einmal beim Rechnen und einmal beim Zeichnen.
    karte.setPadding(polster);
    karte.fitBounds(grenzen as [[number, number], [number, number]], { duration: 0 });
  }

  setzePolster(polster: Polster): void {
    this.karte?.easeTo({ padding: polster, duration: 220 });
  }

  ausschnitt(): { zoom: number; ausschnitt: Ausschnitt } | null {
    const karte = this.karte;
    if (!karte) return null;
    const grenzen = karte.getBounds();
    return {
      zoom: karte.getZoom(),
      ausschnitt: {
        west: grenzen.getWest(),
        sued: grenzen.getSouth(),
        ost: grenzen.getEast(),
        nord: grenzen.getNorth(),
      },
    };
  }

  beiBewegung(hoerer: () => void): void {
    this.karte?.on('moveend', hoerer);
  }

  zerstoere(): void {
    this.schliesseTausch();
    if (this.protokollName) this.modul?.removeProtocol(this.protokollName);
    this.protokollName = null;
    this.karte?.remove();
    this.karte = null;
    this.modul = null;
    this.vorlage = null;
  }

  private entferne(id: string): void {
    const karte = this.karte;
    if (!karte) return;
    if (karte.getLayer(id)) karte.removeLayer(id);
    if (karte.getSource(id)) karte.removeSource(id);
  }
}
