import { InjectionToken } from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Location } from './add-entry.state';

/** Ein Ring, wie ihn Terra Draw nach dem Ziehen zurückgibt. */
export type RingListener = (ring: Location[]) => void;

/**
 * Terra Draw über der Karte: es zeichnet den Ring und lässt seine Eckpunkte
 * mit dem Finger ziehen.
 */
export interface DrawSession {
  /** Legt den Ring neu auf die Karte. Ein leerer Ring löscht ihn. */
  showRing(ring: readonly Location[]): void;
  /** Schaltet auf Auswahl: die Eckpunkte lassen sich ziehen. */
  edit(handler: RingListener): void;
  stop(): void;
}

/**
 * Terra Draw weist Koordinaten mit mehr Stellen zurück. Sechs sind rund elf
 * Zentimeter; genauer trifft weder der Daumen noch die Karte.
 */
const DECIMALS = 1e6;

function gerundet(location: Location): [number, number] {
  return [Math.round(location[0] * DECIMALS) / DECIMALS, Math.round(location[1] * DECIMALS) / DECIMALS];
}

/** Die Formen, die Terra Draw je nach Zahl der Eckpunkte hält. */
export type Geometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] };

/**
 * Welche Form ein Ring gerade hat. Terra Draw nimmt nur Features an, die zu
 * einem seiner Modi passen; ein Ring aus einem oder zwei Punkten ist noch
 * keine Fläche.
 */
export function geometryFor(ring: readonly Location[]): { geometry: Geometry; mode: string } | null {
  if (ring.length === 0) return null;
  if (ring.length === 1)
    return { geometry: { type: 'Point', coordinates: gerundet(ring[0]) }, mode: 'point' };
  const punkte = ring.map(gerundet);
  if (ring.length === 2) {
    return { geometry: { type: 'LineString', coordinates: punkte }, mode: 'linestring' };
  }
  return { geometry: { type: 'Polygon', coordinates: [[...punkte, punkte[0]]] }, mode: 'polygon' };
}

/** Terra Draw und sein MapLibre-Adapter. */
export interface TerraModule {
  terra: typeof import('terra-draw');
  adapter: typeof import('terra-draw-maplibre-gl-adapter');
}

/** Holt beide als eigenes Paket, erst wenn eine Fläche im Spiel ist. */
export type TerraLoader = () => Promise<TerraModule>;

const defaultLoader: TerraLoader = async () => {
  const [terra, adapter] = await Promise.all([
    import('terra-draw'),
    import('terra-draw-maplibre-gl-adapter'),
  ]);
  return { terra, adapter };
};

/**
 * Startet Terra Draw auf der Karte.
 *
 * Die Eckpunkte kommen nicht aus einem Tipp auf die Karte, sondern aus dem
 * Fadenkreuz und dem Knopf darunter (Konzept, „Bedienung am Telefon“): am
 * Telefon trifft der Daumen die Karte schlechter als die Mitte des Bildes.
 * Terra Draw zeichnet den Ring und übernimmt danach das Ziehen der Eckpunkte.
 */
export async function startDrawing(
  map: MapLibreMap,
  farbe: `#${string}`,
  load: TerraLoader = defaultLoader,
): Promise<DrawSession> {
  const { terra, adapter } = await load();
  const draw = new terra.TerraDraw({
    adapter: new adapter.TerraDrawMapLibreGLAdapter({ map: map }),
    modes: [
      new terra.TerraDrawPointMode({ styles: { pointColor: farbe } }),
      new terra.TerraDrawLineStringMode({ styles: { lineStringColor: farbe } }),
      new terra.TerraDrawPolygonMode({
        styles: { fillColor: farbe, outlineColor: farbe, outlineWidth: 2, fillOpacity: 0.18 },
      }),
      new terra.TerraDrawSelectMode({
        flags: {
          polygon: {
            feature: {
              draggable: false,
              coordinates: { midpoints: true, draggable: true, deletable: true },
            },
          },
        },
      }),
    ],
  });
  draw.start();
  // Auswahl ist der einzige Modus, der auf einen Tipp nichts zeichnet. Der Ring
  // kommt ausschließlich über `zeigeRing` herein.
  draw.setMode('select');

  let id: string | number | null = null;

  return {
    showRing: (ring) => {
      draw.clear();
      id = null;
      const form = geometryFor(ring);
      if (form === null) return;
      id = draw.getFeatureId();
      draw.addFeatures([
        { id: id, type: 'Feature', geometry: form.geometry, properties: { mode: form.mode } },
      ]);
    },
    edit: (handler) => {
      if (id === null) return;
      draw.selectFeature(id);
      draw.on('change', () => {
        const feature = id === null ? undefined : draw.getSnapshotFeature(id);
        if (feature?.geometry.type !== 'Polygon') return;
        // Der geschlossene Ring trägt den ersten Punkt zweimal; die Oberfläche
        // zählt Eckpunkte, nicht Stützstellen.
        const punkte = feature.geometry.coordinates[0].slice(0, -1);
        handler(punkte.map((point) => [point[0], point[1]] as Location));
      });
    },
    stop: () => {
      draw.clear();
      draw.stop();
    },
  };
}

/** Der Zeichner hinter einem Token, damit ein Test ihn ohne WebGL stellt. */
export const ZONE_DRAWER = new InjectionToken<typeof startDrawing>('ZonenZeichner', {
  providedIn: 'root',
  factory: () => startDrawing,
});
