import type { FeatureCollection } from 'geojson';
import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
  MapSourceDataEvent,
  Subscription,
} from 'maplibre-gl';
import type { Viewbox } from './tile-grid';

/** Nur der Teil von MapLibre, den der Adapter braucht. */
export type MaplibreModule = Pick<
  typeof import('maplibre-gl'),
  'Map' | 'AttributionControl' | 'addProtocol' | 'removeProtocol' | 'setWorkerUrl'
>;

/**
 * Wo der Worker von MapLibre liegt.
 *
 * MapLibre baut den Pfad sonst zur Laufzeit aus `import.meta.url` und sucht
 * `maplibre-gl-worker.mjs` neben dem Bündel. Dort liegt die Datei nicht: der
 * Bündler kopiert sie nicht mit, und der Webserver antwortet für einen
 * unbekannten Pfad mit der Seite selbst. Firefox lehnt den Worker dann wegen
 * des MIME-Typs ab, und die Karte bleibt leer. Die Datei wird darum als Asset
 * ausgeliefert (`angular.json`) und hier benannt.
 */
export const WORKER_PATH = '/assets/maplibre/maplibre-gl-worker.mjs';

/** Südwest- und Nordostecke als [Länge, Breite]. */
export type Bounds = readonly [readonly [number, number], readonly [number, number]];

/**
 * Zwei Wertebenen liegen übereinander: die Vorhersage unten, die Eingabe-Ebene
 * darüber. Jede Rolle hat eigene Quellen und eine eigene Deckkraft.
 */
export type Role = 'vorhersage' | 'ebene';

export const ROLES: readonly Role[] = ['vorhersage', 'ebene'];

/** Der freie Streifen der Karte: was Blatt, Navigation und Kopf verdecken. */
export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Ein eigenes Protokoll, das MapLibre kennen muss, bevor die erste Kachel fällt. */
export interface Protocol {
  name: string;
  resolve: (url: string) => Promise<{ data: ImageBitmap | ArrayBuffer }>;
}

export interface MapOptions {
  style: string;
  centerPoint: readonly [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  maxBounds: Bounds;
  protocol: Protocol;
  /** Am Telefon steht der Urheberhinweis eingeklappt, sonst deckte er die Karte. */
  compact: boolean;
}

/**
 * Die eigenen Ebenen über der Vorhersage, von unten nach oben. Zonen liegen
 * als Fläche unten, Punkte darüber, damit ein Fund in seiner Zone anklickbar
 * bleibt.
 */
export const OBJECT_LAYERS = ['zonen', 'geteilteFunde', 'marker', 'funde', 'location'] as const;
export type ObjectLayer = (typeof OBJECT_LAYERS)[number];

/**
 * Was die Kartenseite von der Karte braucht. Die Seite kennt MapLibre nicht;
 * so bleibt sie ohne WebGL testbar.
 */
export interface MapAdapter {
  /** Holt MapLibre schon, bevor die Karte gebraucht wird. */
  warmUp(): void;
  start(host: HTMLElement, options: MapOptions): Promise<void>;
  setStyle(style: string): void;
  /** Legt die Kacheln einer Rolle auf die Karte, ohne Flackern. `null` räumt sie ab. */
  showValue(role: Role, template: string | null, bounds: Bounds, zoomVon: number, zoomBis: number): void;
  /** Deckkraft einer Rolle, 0 bis 1. */
  setOpacity(role: Role, value: number): void;
  fitBounds(bounds: Bounds, padding: Padding): void;
  setPadding(padding: Padding): void;
  centerOn(point: readonly [number, number], zoom: number): void;
  extent(): { zoom: number; extent: Viewbox } | null;
  onMove(handler: () => void): void;
  destroy(): void;
  /** Der Ort unter dem Fadenkreuz: die Mitte des freien Streifens. */
  center(): readonly [number, number] | null;
  /** Fährt zu einem Ort. Ohne Zoom bleibt die Stufe, wie sie ist. */
  flyTo(centerPoint: readonly [number, number], zoom?: number): void;
  /** Legt die eigenen Objekte einer Ebene auf die Karte. */
  showObjects(layer: ObjectLayer, data: FeatureCollection): void;
  /** Nimmt eine Ebene von der Karte, ohne die anderen anzufassen. */
  hideObjects(layer: ObjectLayer): void;
  /** Ein Tipp auf ein Objekt. Die Kennung steht in `id` des Features. */
  onObjectSelect(handler: (layer: ObjectLayer, id: string) => void): void;
  /** Die rohe Karte für Terra Draw. `null`, solange sie nicht steht. */
  rawMap(): MapLibreMap | null;
}

/** Nach dieser Zeit wird die neue Woche auch ohne alle Kacheln sichtbar. */
const SWAP_DEADLINE = 1500;

/** Der Zustand einer Rolle: welche Quelle liegt, welche wartet. */
interface RoleState {
  active: 0 | 1;
  template: string | null;
  space: { bounds: Bounds; zoomVon: number; zoomBis: number } | null;
  swap: (() => void) | null;
  opacity: number;
}

function newRoleState(): RoleState {
  return { active: 0, template: null, space: null, swap: null, opacity: 1 };
}

/** Die beiden Ebenen-Namen einer Rolle. Sie wechseln sich beim Nachladen ab. */
function layerName(role: Role, space: 0 | 1): string {
  return `wert-${role}-${space === 0 ? 'a' : 'b'}`;
}

/** Ein gerundeter Fund liegt irgendwo in dieser Masche, nicht auf dem Punkt. */
const ROUNDED_RADIUS = 18;
const POINT_RADIUS = 7;

/** Der eigene Standort trägt nie eine der sechs Objektfarben, sondern Blau. */
const LOCATION_COLOR = '#1a73e8';

function sourceFor(layer: ObjectLayer): string {
  return `objekte-${layer}`;
}

/** Die Schichten einer Ebene, in der Reihenfolge, in der sie liegen. */
function layerPaintLayers(layer: ObjectLayer): string[] {
  if (layer === 'zonen') return ['objekte-zonen-flaeche', 'objekte-zonen-linie'];
  if (layer === 'location') return ['objekte-location-kreis', 'objekte-location-punkt'];
  return [`objekte-${layer}-punkt`];
}

/**
 * Wie eine Ebene aussieht. Die Farbe steht am Feature, nicht in der Schicht:
 * so trägt jede Zone und jeder Marker die gewählte der sechs Farben.
 *
 * Ein gerundeter geteilter Fund wird zum großen, blassen Kreis. Er behauptet
 * damit keinen Punkt, den es so nicht gibt.
 */
function paintLayersFor(layer: ObjectLayer): LayerSpecification[] {
  const source = sourceFor(layer);
  if (layer === 'zonen') {
    return [
      {
        id: 'objekte-zonen-flaeche',
        type: 'fill',
        source: source,
        paint: { 'fill-color': ['get', 'farbe'], 'fill-opacity': 0.18 },
      },
      {
        id: 'objekte-zonen-linie',
        type: 'line',
        source: source,
        paint: { 'line-color': ['get', 'farbe'], 'line-width': 2 },
      },
    ];
  }
  if (layer === 'location') {
    return [
      {
        id: 'objekte-location-kreis',
        type: 'fill',
        source: source,
        // Der Genauigkeitskreis kommt als Fläche in Grad, damit er beim Zoomen
        // mit dem Gelände wächst statt als fester Punktradius stehen zu bleiben.
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': LOCATION_COLOR, 'fill-opacity': 0.15 },
      },
      {
        id: 'objekte-location-punkt',
        type: 'circle',
        source: source,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': POINT_RADIUS,
          'circle-color': LOCATION_COLOR,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      },
    ];
  }
  if (layer === 'geteilteFunde') {
    return [
      {
        id: 'objekte-geteilteFunde-punkt',
        type: 'circle',
        source: source,
        paint: {
          'circle-radius': ['case', ['get', 'gerundet'], ROUNDED_RADIUS, POINT_RADIUS],
          'circle-color': ['get', 'farbe'],
          'circle-opacity': ['case', ['get', 'gerundet'], 0.25, 0.85],
          'circle-stroke-width': ['case', ['get', 'gerundet'], 0, 2],
          'circle-stroke-color': '#ffffff',
        },
      },
    ];
  }
  return [
    {
      id: `objekte-${layer}-punkt`,
      type: 'circle',
      source: source,
      paint: {
        'circle-radius': POINT_RADIUS,
        'circle-color': ['get', 'farbe'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    },
  ];
}

/**
 * MapLibre hinter der Schnittstelle.
 *
 * Der Wechsel einer Woche läuft über zwei Rasterquellen je Rolle: die neue
 * wird unsichtbar geladen und erst sichtbar geschaltet, wenn ihre Kacheln da
 * sind. Ein Tausch an einer Quelle würde die Karte kurz leer zeigen.
 */
export class MapLibreAdapter implements MapAdapter {
  private module: MaplibreModule | null = null;
  private protocolName: string | null = null;
  private map: MapLibreMap | null = null;
  private readonly states = new Map<Role, RoleState>(ROLES.map((role) => [role, newRoleState()]));
  /** Was auf den eigenen Ebenen liegt. Ein Stilwechsel legt es von hier neu auf. */
  private readonly objects = new Map<ObjectLayer, FeatureCollection>();
  /** Die Klick-Anmeldungen je Ebene. Ein Stilwechsel löst sie und meldet neu an. */
  private readonly abos = new Map<ObjectLayer, Subscription[]>();
  private chosen: ((layer: ObjectLayer, id: string) => void) | null = null;

  constructor(private readonly load: () => Promise<MaplibreModule>) {}

  warmUp(): void {
    // Der Modullader gibt beim zweiten Aufruf dasselbe Versprechen zurück; ein
    // früher Anstoß kostet darum nichts und spart den Weg über den ersten Rahmen.
    void this.load();
  }

  async start(host: HTMLElement, options: MapOptions): Promise<void> {
    const module = await this.load();
    this.module = module;
    module.setWorkerUrl(WORKER_PATH);
    // Das Protokoll steht vor der Karte, sonst fiele die erste Kachel ins Leere.
    module.addProtocol(options.protocol.name, (request) => options.protocol.resolve(request.url));
    this.protocolName = options.protocol.name;
    this.map = new module.Map({
      container: host,
      style: options.style,
      center: [options.centerPoint[0], options.centerPoint[1]],
      zoom: options.zoom,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      maxBounds: options.maxBounds as [[number, number], [number, number]],
      // Den Text liefert der Stil von OpenFreeMap selbst; ein zweiter eigener
      // stünde doppelt da.
      attributionControl: false,
    });
    // Der Hinweis steht unten links, weg von der Knopfgruppe oben und weg von
    // „Eintragen“ unten rechts. Das Blatt deckt ihn nicht zu: `styles.scss`
    // hebt ihn über dessen Kopf.
    this.map.addControl(new module.AttributionControl({ compact: options.compact }), 'bottom-left');
    if (options.compact) this.collapseAttribution(host);
    // Eine Quelle vor dem Stil wirft. `style.load` ist das erste Ereignis, nach
    // dem der Stil steht; `load` wartet zusätzlich auf jede Kachel und bleibt
    // über einer langsamen Leitung lange aus.
    await new Promise<void>((done) => {
      this.map?.once('style.load', () => {
        done();
      });
    });
  }

  setStyle(style: string): void {
    const map = this.map;
    if (!map) return;
    map.setStyle(style);
    // Ein neuer Stil wirft alle eigenen Quellen weg. Sie kommen zurück, sobald
    // der Stil steht, sonst wären Vorhersage und Ebene nach dem Wechsel fort.
    map.once('style.load', () => {
      for (const role of ROLES) {
        const state = this.state(role);
        const template = state.template;
        const space = state.space;
        state.active = 0;
        state.template = null;
        state.swap = null;
        if (template && space) this.showValue(role, template, space.bounds, space.zoomVon, space.zoomBis);
      }
      for (const [layer, data] of this.objects) this.addObjectLayer(layer, data);
    });
  }

  showValue(role: Role, template: string | null, bounds: Bounds, zoomVon: number, zoomBis: number): void {
    const map = this.map;
    const state = this.state(role);
    if (!map || template === state.template) return;
    // Ein noch offener Tausch wird zuerst zu Ende gebracht, sonst lägen drei
    // Wochen übereinander und keine wäre sichtbar.
    this.finishSwap(role);
    const alt = layerName(role, state.active);
    const next = layerName(role, state.active === 0 ? 1 : 0);
    state.template = template;
    if (template === null) {
      this.remove(alt);
      this.remove(next);
      state.space = null;
      return;
    }
    state.space = { bounds, zoomVon, zoomBis };
    this.remove(next);
    map.addSource(next, {
      type: 'raster',
      tiles: [template],
      tileSize: 256,
      minzoom: zoomVon,
      maxzoom: zoomBis,
      bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]],
      attribution: '',
    });
    map.addLayer(
      {
        id: next,
        type: 'raster',
        source: next,
        paint: {
          'raster-opacity': map.getLayer(alt) ? 0 : state.opacity,
          // Ohne diese beiden Nullen blendet MapLibre über 300 ms ein. Die alte
          // Woche ist da schon weg, und dazwischen bliebe die Karte leer.
          'raster-opacity-transition': { duration: 0, delay: 0 },
          'raster-fade-duration': 0,
          // Die Kacheln reichen bis Zoom 8, das Raster darunter misst 500 m
          // und ist geglättet. Weich hochgerechnet verliefe ein Rand bis zu
          // einem Kilometer neben den Wald der Grundkarte, und das sähe aus wie
          // ein Versatz. Als Quadrat sieht man die Zellgrenze und weiß, wie
          // grob gemessen wird.
          'raster-resampling': 'nearest',
        },
      },
      this.ueber(role),
    );
    state.active = state.active === 0 ? 1 : 0;
    if (!map.getLayer(alt)) return;
    this.swapAfterLoad(map, role, alt, next);
  }

  setOpacity(role: Role, value: number): void {
    const state = this.state(role);
    state.opacity = Math.min(Math.max(value, 0), 1);
    const map = this.map;
    if (!map || state.template === null) return;
    // Nur die sichtbare Ebene: die wartende steht auf 0 und käme sonst zu früh.
    const visible = layerName(role, state.active);
    if (map.getLayer(visible)) map.setPaintProperty(visible, 'raster-opacity', state.opacity);
  }

  fitBounds(bounds: Bounds, padding: Padding): void {
    const map = this.map;
    if (!map) return;
    // Das Polster gehört an die Karte, nicht an den Aufruf: `fitBounds` zöge es
    // sonst zweimal ab, einmal beim Rechnen und einmal beim Zeichnen.
    map.setPadding(padding);
    map.fitBounds(bounds as [[number, number], [number, number]], { duration: 0 });
  }

  setPadding(padding: Padding): void {
    this.map?.easeTo({ padding: padding, duration: 220 });
  }

  centerOn(point: readonly [number, number], zoom: number): void {
    this.map?.easeTo({ center: [point[0], point[1]], zoom, duration: 600 });
  }

  extent(): { zoom: number; extent: Viewbox } | null {
    const map = this.map;
    if (!map) return null;
    const bounds = map.getBounds();
    return {
      zoom: map.getZoom(),
      extent: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        ost: bounds.getEast(),
        nord: bounds.getNorth(),
      },
    };
  }

  onMove(handler: () => void): void {
    this.map?.on('moveend', handler);
  }

  destroy(): void {
    for (const role of ROLES) this.finishSwap(role);
    if (this.protocolName) this.module?.removeProtocol(this.protocolName);
    this.protocolName = null;
    this.map?.remove();
    this.map = null;
    this.module = null;
    for (const role of ROLES) this.states.set(role, newRoleState());
    this.objects.clear();
    for (const layer of this.abos.keys()) this.unsubscribeAll(layer);
  }

  private state(role: Role): RoleState {
    let state = this.states.get(role);
    if (!state) {
      state = newRoleState();
      this.states.set(role, state);
    }
    return state;
  }

  /**
   * Vor welcher Ebene die neue liegt. Die Vorhersage gehört unter die
   * Eingabe-Ebene, sonst verdeckte sie die Ebene, die man gerade lesen will.
   */
  private ueber(role: Role): string | undefined {
    const map = this.map;
    if (role !== 'vorhersage' || !map) return undefined;
    for (const space of [0, 1] as const) {
      const name = layerName('ebene', space);
      if (map.getLayer(name)) return name;
    }
    return undefined;
  }

  /**
   * Blendet die neue Woche ein, sobald ihre Kacheln liegen, und nimmt die alte
   * weg. Die Frist ist die Notbremse: fehlt eine Kachel dauerhaft, bliebe die
   * neue Woche sonst für immer unsichtbar.
   */
  private swapAfterLoad(map: MapLibreMap, role: Role, alt: string, next: string): void {
    const state = this.state(role);
    const done = (): void => {
      clearTimeout(deadline);
      map.off('sourcedata', onData);
      state.swap = null;
      map.setPaintProperty(next, 'raster-opacity', state.opacity);
      this.remove(alt);
    };
    const onData = (event: MapSourceDataEvent): void => {
      // Die Meldungen zur Quelle selbst („Beschreibung gelesen“, „sichtbar
      // geschaltet“) kommen, bevor die erste Kachel angefragt ist. Auf sie zu
      // hören hieße, die alte Woche vor der neuen wegzunehmen.
      if (event.sourceId !== next) return;
      if (event.sourceDataType === 'metadata' || event.sourceDataType === 'visibility') return;
      if (event.isSourceLoaded) done();
    };
    const deadline = setTimeout(done, SWAP_DEADLINE);
    state.swap = done;
    map.on('sourcedata', onData);
  }

  private finishSwap(role: Role): void {
    const state = this.state(role);
    const swap = state.swap;
    state.swap = null;
    swap?.();
  }

  center(): readonly [number, number] | null {
    const map = this.map;
    if (!map) return null;
    // `getCenter` rechnet das Polster schon ein: die Mitte ist die Mitte des
    // freien Streifens, also genau der Ort unter dem Fadenkreuz.
    const center = map.getCenter();
    return [center.lng, center.lat];
  }

  flyTo(centerPoint: readonly [number, number], zoom?: number): void {
    this.map?.easeTo({ center: [centerPoint[0], centerPoint[1]], zoom, duration: 400 });
  }

  showObjects(layer: ObjectLayer, data: FeatureCollection): void {
    this.objects.set(layer, data);
    this.addObjectLayer(layer, data);
  }

  hideObjects(layer: ObjectLayer): void {
    this.objects.delete(layer);
    this.unsubscribeAll(layer);
    for (const id of layerPaintLayers(layer)) this.remove(id);
    this.remove(sourceFor(layer));
  }

  onObjectSelect(handler: (layer: ObjectLayer, id: string) => void): void {
    this.chosen = handler;
  }

  rawMap(): MapLibreMap | null {
    return this.map;
  }

  /**
   * Schreibt die Daten in die Quelle der Ebene und legt Quelle und Schichten
   * an, falls der Stil sie noch nicht trägt.
   */
  private addObjectLayer(layer: ObjectLayer, data: FeatureCollection): void {
    const map = this.map;
    if (!map) return;
    const source = sourceFor(layer);
    const existing = map.getSource<GeoJSONSource>(source);
    if (existing) {
      // `setData` gibt ein Versprechen zurück; niemand wartet darauf, weil die
      // Karte selbst neu zeichnet, sobald die Quelle steht.
      void existing.setData(data);
      return;
    }
    this.unsubscribeAll(layer);
    map.addSource(source, { type: 'geojson', data: data });
    const abos: Subscription[] = [];
    for (const paintLayer of paintLayersFor(layer)) {
      map.addLayer(paintLayer);
      abos.push(
        map.on('click', paintLayer.id, (event) => {
          const id = event.features?.[0]?.properties?.['id'] as string | undefined;
          if (id !== undefined) this.chosen?.(layer, id);
        }),
      );
    }
    this.abos.set(layer, abos);
  }

  private unsubscribeAll(layer: ObjectLayer): void {
    for (const abo of this.abos.get(layer) ?? []) abo.unsubscribe();
    this.abos.delete(layer);
  }

  private remove(id: string): void {
    const map = this.map;
    if (!map) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }

  /**
   * MapLibre zeigt den Hinweis zunächst offen. Am Telefon deckt er damit die
   * halbe Karte; ein Tipp auf das i klappt ihn auf.
   *
   * Die Klasse `maplibregl-compact` wird hier von Hand gesetzt: MapLibre setzt
   * sie erst, wenn der Text da ist, und hängt dabei jedes Mal wieder das
   * offene `-show` an. Steht sie schon, lässt es beide in Ruhe.
   */
  private collapseAttribution(host: HTMLElement): void {
    const hint = host.querySelector('.maplibregl-ctrl-attrib');
    hint?.classList.add('maplibregl-compact');
    hint?.classList.remove('maplibregl-compact-show');
  }
}
