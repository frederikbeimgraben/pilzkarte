import type { Map as MapLibreKarte } from 'maplibre-gl';
import type { Ausschnitt } from './kachel-raster';

/** Nur der Teil von MapLibre, den der Adapter braucht. */
export type MaplibreModul = Pick<typeof import('maplibre-gl'), 'Map' | 'addProtocol' | 'removeProtocol'>;

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
  urheber: string;
  protokoll: Protokoll;
}

/**
 * Was die Kartenseite von der Karte braucht. Die Seite kennt MapLibre nicht;
 * so bleibt sie ohne WebGL testbar.
 */
export interface MapAdapter {
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
  private wertRaum: { grenzen: Grenzen; zoomVon: number; zoomBis: number } | null = null;

  constructor(private readonly lade: () => Promise<MaplibreModul>) {}

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
      attributionControl: { compact: false, customAttribution: optionen.urheber },
    });
  }

  setzeStil(stil: string): void {
    const karte = this.karte;
    if (!karte) return;
    karte.setStyle(stil);
    // Ein neuer Stil wirft alle eigenen Quellen weg. Sie kommen zurück, sobald
    // der Stil steht, sonst wäre die Vorhersage nach dem Themenwechsel fort.
    karte.once('styledata', () => {
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
      paint: { 'raster-opacity': karte.getLayer(alt) ? 0 : 1, 'raster-fade-duration': 0 },
    });
    this.aktiv = 1 - this.aktiv;
    if (!karte.getLayer(alt)) return;
    const tausche = (): void => {
      if (!karte.isSourceLoaded(neu)) return;
      karte.off('idle', tausche);
      karte.setPaintProperty(neu, 'raster-opacity', 1);
      this.entferne(alt);
    };
    karte.on('idle', tausche);
  }

  passeEin(grenzen: Grenzen, polster: Polster): void {
    this.karte?.fitBounds(grenzen as [[number, number], [number, number]], {
      padding: polster,
      duration: 0,
    });
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
