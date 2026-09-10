import type { Map as MapLibreKarte, MapSourceDataEvent } from 'maplibre-gl';
import type { Ausschnitt } from './kachel-raster';

/** Nur der Teil von MapLibre, den der Adapter braucht. */
export type MaplibreModul = Pick<
  typeof import('maplibre-gl'),
  'Map' | 'AttributionControl' | 'addProtocol' | 'removeProtocol'
>;

/** Südwest- und Nordostecke als [Länge, Breite]. */
export type Grenzen = readonly [readonly [number, number], readonly [number, number]];

/**
 * Zwei Wertebenen liegen übereinander: die Vorhersage unten, die Eingabe-Ebene
 * darüber. Jede Rolle hat eigene Quellen und eine eigene Deckkraft.
 */
export type Rolle = 'vorhersage' | 'ebene';

export const ROLLEN: readonly Rolle[] = ['vorhersage', 'ebene'];

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
  /** Am Telefon steht der Urheberhinweis eingeklappt, sonst deckte er die Karte. */
  kompakt: boolean;
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
  /** Legt die Kacheln einer Rolle auf die Karte, ohne Flackern. `null` räumt sie ab. */
  zeigeWert(rolle: Rolle, vorlage: string | null, grenzen: Grenzen, zoomVon: number, zoomBis: number): void;
  /** Deckkraft einer Rolle, 0 bis 1. */
  setzeDeckkraft(rolle: Rolle, wert: number): void;
  passeEin(grenzen: Grenzen, polster: Polster): void;
  setzePolster(polster: Polster): void;
  zentriere(punkt: readonly [number, number], zoom: number): void;
  ausschnitt(): { zoom: number; ausschnitt: Ausschnitt } | null;
  beiBewegung(hoerer: () => void): void;
  zerstoere(): void;
}

/** Nach dieser Zeit wird die neue Woche auch ohne alle Kacheln sichtbar. */
const TAUSCH_FRIST = 1500;

/** Der Zustand einer Rolle: welche Quelle liegt, welche wartet. */
interface RollenStand {
  aktiv: 0 | 1;
  vorlage: string | null;
  raum: { grenzen: Grenzen; zoomVon: number; zoomBis: number } | null;
  tausch: (() => void) | null;
  deckkraft: number;
}

function neuerStand(): RollenStand {
  return { aktiv: 0, vorlage: null, raum: null, tausch: null, deckkraft: 1 };
}

/** Die beiden Ebenen-Namen einer Rolle. Sie wechseln sich beim Nachladen ab. */
function ebeneName(rolle: Rolle, platz: 0 | 1): string {
  return `wert-${rolle}-${platz === 0 ? 'a' : 'b'}`;
}

/**
 * MapLibre hinter der Schnittstelle.
 *
 * Der Wechsel einer Woche läuft über zwei Rasterquellen je Rolle: die neue
 * wird unsichtbar geladen und erst sichtbar geschaltet, wenn ihre Kacheln da
 * sind. Ein Tausch an einer Quelle würde die Karte kurz leer zeigen.
 */
export class MapLibreAdapter implements MapAdapter {
  private modul: MaplibreModul | null = null;
  private protokollName: string | null = null;
  private karte: MapLibreKarte | null = null;
  private readonly staende = new Map<Rolle, RollenStand>(ROLLEN.map((rolle) => [rolle, neuerStand()]));

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
    this.karte.addControl(new modul.AttributionControl({ compact: optionen.kompakt }), 'top-right');
    if (optionen.kompakt) this.klappeHinweisEin(wirt);
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
    // der Stil steht, sonst wären Vorhersage und Ebene nach dem Wechsel fort.
    karte.once('style.load', () => {
      for (const rolle of ROLLEN) {
        const stand = this.stand(rolle);
        const vorlage = stand.vorlage;
        const raum = stand.raum;
        stand.aktiv = 0;
        stand.vorlage = null;
        stand.tausch = null;
        if (vorlage && raum) this.zeigeWert(rolle, vorlage, raum.grenzen, raum.zoomVon, raum.zoomBis);
      }
    });
  }

  zeigeWert(rolle: Rolle, vorlage: string | null, grenzen: Grenzen, zoomVon: number, zoomBis: number): void {
    const karte = this.karte;
    const stand = this.stand(rolle);
    if (!karte || vorlage === stand.vorlage) return;
    // Ein noch offener Tausch wird zuerst zu Ende gebracht, sonst lägen drei
    // Wochen übereinander und keine wäre sichtbar.
    this.schliesseTausch(rolle);
    const alt = ebeneName(rolle, stand.aktiv);
    const neu = ebeneName(rolle, stand.aktiv === 0 ? 1 : 0);
    stand.vorlage = vorlage;
    if (vorlage === null) {
      this.entferne(alt);
      this.entferne(neu);
      stand.raum = null;
      return;
    }
    stand.raum = { grenzen, zoomVon, zoomBis };
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
    karte.addLayer(
      {
        id: neu,
        type: 'raster',
        source: neu,
        paint: {
          'raster-opacity': karte.getLayer(alt) ? 0 : stand.deckkraft,
          // Ohne diese beiden Nullen blendet MapLibre über 300 ms ein. Die alte
          // Woche ist da schon weg, und dazwischen bliebe die Karte leer.
          'raster-opacity-transition': { duration: 0, delay: 0 },
          'raster-fade-duration': 0,
        },
      },
      this.ueber(rolle),
    );
    stand.aktiv = stand.aktiv === 0 ? 1 : 0;
    if (!karte.getLayer(alt)) return;
    this.tauscheNachLaden(karte, rolle, alt, neu);
  }

  setzeDeckkraft(rolle: Rolle, wert: number): void {
    const stand = this.stand(rolle);
    stand.deckkraft = Math.min(Math.max(wert, 0), 1);
    const karte = this.karte;
    if (!karte || stand.vorlage === null) return;
    // Nur die sichtbare Ebene: die wartende steht auf 0 und käme sonst zu früh.
    const sichtbar = ebeneName(rolle, stand.aktiv);
    if (karte.getLayer(sichtbar)) karte.setPaintProperty(sichtbar, 'raster-opacity', stand.deckkraft);
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

  zentriere(punkt: readonly [number, number], zoom: number): void {
    this.karte?.easeTo({ center: [punkt[0], punkt[1]], zoom, duration: 600 });
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
    for (const rolle of ROLLEN) this.schliesseTausch(rolle);
    if (this.protokollName) this.modul?.removeProtocol(this.protokollName);
    this.protokollName = null;
    this.karte?.remove();
    this.karte = null;
    this.modul = null;
    for (const rolle of ROLLEN) this.staende.set(rolle, neuerStand());
  }

  private stand(rolle: Rolle): RollenStand {
    let stand = this.staende.get(rolle);
    if (!stand) {
      stand = neuerStand();
      this.staende.set(rolle, stand);
    }
    return stand;
  }

  /**
   * Vor welcher Ebene die neue liegt. Die Vorhersage gehört unter die
   * Eingabe-Ebene, sonst verdeckte sie die Ebene, die man gerade lesen will.
   */
  private ueber(rolle: Rolle): string | undefined {
    const karte = this.karte;
    if (rolle !== 'vorhersage' || !karte) return undefined;
    for (const platz of [0, 1] as const) {
      const name = ebeneName('ebene', platz);
      if (karte.getLayer(name)) return name;
    }
    return undefined;
  }

  /**
   * Blendet die neue Woche ein, sobald ihre Kacheln liegen, und nimmt die alte
   * weg. Die Frist ist die Notbremse: fehlt eine Kachel dauerhaft, bliebe die
   * neue Woche sonst für immer unsichtbar.
   */
  private tauscheNachLaden(karte: MapLibreKarte, rolle: Rolle, alt: string, neu: string): void {
    const stand = this.stand(rolle);
    const fertig = (): void => {
      clearTimeout(frist);
      karte.off('sourcedata', beiDaten);
      stand.tausch = null;
      karte.setPaintProperty(neu, 'raster-opacity', stand.deckkraft);
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
    stand.tausch = fertig;
    karte.on('sourcedata', beiDaten);
  }

  private schliesseTausch(rolle: Rolle): void {
    const stand = this.stand(rolle);
    const tausch = stand.tausch;
    stand.tausch = null;
    tausch?.();
  }

  private entferne(id: string): void {
    const karte = this.karte;
    if (!karte) return;
    if (karte.getLayer(id)) karte.removeLayer(id);
    if (karte.getSource(id)) karte.removeSource(id);
  }

  /**
   * MapLibre zeigt den Hinweis zunächst offen. Am Telefon deckt er damit die
   * halbe Karte; ein Tipp auf das i klappt ihn auf.
   *
   * Die Klasse `maplibregl-compact` wird hier von Hand gesetzt: MapLibre setzt
   * sie erst, wenn der Text da ist, und hängt dabei jedes Mal wieder das
   * offene `-show` an. Steht sie schon, lässt es beide in Ruhe.
   */
  private klappeHinweisEin(wirt: HTMLElement): void {
    const hinweis = wirt.querySelector('.maplibregl-ctrl-attrib');
    hinweis?.classList.add('maplibregl-compact');
    hinweis?.classList.remove('maplibregl-compact-show');
  }
}
