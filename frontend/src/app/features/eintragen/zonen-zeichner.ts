import { InjectionToken } from '@angular/core';
import type { Map as MapLibreKarte } from 'maplibre-gl';
import type { Ort } from './eintragen.zustand';

/** Ein Ring, wie ihn Terra Draw nach dem Ziehen zurückgibt. */
export type RingHoerer = (ring: Ort[]) => void;

/**
 * Terra Draw über der Karte: es zeichnet den Ring und lässt seine Eckpunkte
 * mit dem Finger ziehen.
 */
export interface ZeichenSitzung {
  /** Legt den Ring neu auf die Karte. Ein leerer Ring löscht ihn. */
  zeigeRing(ring: readonly Ort[]): void;
  /** Schaltet auf Auswahl: die Eckpunkte lassen sich ziehen. */
  bearbeiten(hoerer: RingHoerer): void;
  beende(): void;
}

/** Die Formen, die Terra Draw je nach Zahl der Eckpunkte hält. */
export type Geometrie =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] };

/**
 * Welche Form ein Ring gerade hat. Terra Draw nimmt nur Features an, die zu
 * einem seiner Modi passen; ein Ring aus einem oder zwei Punkten ist noch
 * keine Fläche.
 */
export function geometrieFuer(ring: readonly Ort[]): { geometrie: Geometrie; modus: string } | null {
  if (ring.length === 0) return null;
  if (ring.length === 1) {
    return { geometrie: { type: 'Point', coordinates: [ring[0][0], ring[0][1]] }, modus: 'point' };
  }
  const punkte: [number, number][] = ring.map(([lon, lat]) => [lon, lat]);
  if (ring.length === 2) {
    return { geometrie: { type: 'LineString', coordinates: punkte }, modus: 'linestring' };
  }
  return { geometrie: { type: 'Polygon', coordinates: [[...punkte, punkte[0]]] }, modus: 'polygon' };
}

/** Terra Draw und sein MapLibre-Adapter. */
export interface TerraModul {
  terra: typeof import('terra-draw');
  adapter: typeof import('terra-draw-maplibre-gl-adapter');
}

/** Holt beide als eigenes Paket, erst wenn eine Fläche im Spiel ist. */
export type TerraLader = () => Promise<TerraModul>;

const standardLader: TerraLader = async () => {
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
export async function starteZeichnen(
  karte: MapLibreKarte,
  farbe: `#${string}`,
  lade: TerraLader = standardLader,
): Promise<ZeichenSitzung> {
  const { terra, adapter } = await lade();
  const draw = new terra.TerraDraw({
    adapter: new adapter.TerraDrawMapLibreGLAdapter({ map: karte }),
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

  let kennung: string | number | null = null;

  return {
    zeigeRing: (ring) => {
      draw.clear();
      kennung = null;
      const form = geometrieFuer(ring);
      if (form === null) return;
      kennung = draw.getFeatureId();
      draw.addFeatures([
        { id: kennung, type: 'Feature', geometry: form.geometrie, properties: { mode: form.modus } },
      ]);
    },
    bearbeiten: (hoerer) => {
      if (kennung === null) return;
      draw.selectFeature(kennung);
      draw.on('change', () => {
        const feature = kennung === null ? undefined : draw.getSnapshotFeature(kennung);
        if (feature?.geometry.type !== 'Polygon') return;
        // Der geschlossene Ring trägt den ersten Punkt zweimal; die Oberfläche
        // zählt Eckpunkte, nicht Stützstellen.
        const punkte = feature.geometry.coordinates[0].slice(0, -1);
        hoerer(punkte.map((punkt) => [punkt[0], punkt[1]] as Ort));
      });
    },
    beende: () => {
      draw.clear();
      draw.stop();
    },
  };
}

/** Der Zeichner hinter einem Token, damit ein Test ihn ohne WebGL stellt. */
export const ZONEN_ZEICHNER = new InjectionToken<typeof starteZeichnen>('ZonenZeichner', {
  providedIn: 'root',
  factory: () => starteZeichnen,
});
