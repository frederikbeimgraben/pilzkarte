import { Directive, effect, inject } from '@angular/core';
import type { Feature, FeatureCollection } from 'geojson';
import type { Find, SharedFind, Marker, Zone } from '../../core/api/models';
import { MAP_ADAPTER } from '../../map/map.tokens';
import type { ObjectLayer } from '../../map/map-adapter';
import { EntriesState } from '../entries/entries.state';
import { colorHex } from '../entries/colors';
import { MapState, type ObjectKind } from '../map/map.state';

/**
 * Die Farben der Punkte aus `docs/mockups/bauen.py`: ein eigener Fund trägt
 * `accent4`, ein fremder geteilter das gedämpfte `info`. So sind die eigenen
 * Funde auf der Karte auf einen Blick von den fremden zu unterscheiden.
 */
const OWN_FIND = '#c8a25a';
const FOREIGN_FIND = '#185468';

function point(id: string, lon: number, lat: number, props: Record<string, string | boolean>): Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id, ...props },
  };
}

function collection(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

/**
 * Legt die eigenen Marker, Zonen und Funde sowie die geteilten Funde auf die
 * Karte und öffnet auf einen Tipp das Objekt-Blatt.
 *
 * Was liegt, entscheiden die drei Signale des Kartenzustands; der Ebenen-Knopf
 * aus B1 schaltet dieselben Signale.
 */
@Directive({ selector: '[appMapObjects]' })
export class MapObjectsDirective {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly eintraege = inject(EntriesState);
  private readonly map = inject(MapState);

  constructor() {
    this.adapter.onObjectSelect((layer, id) => {
      this.open(layer, id);
    });

    effect(() => {
      this.put('zonen', this.map.showZones(), () => this.zones(this.eintraege.zones()));
    });
    effect(() => {
      this.put('marker', this.map.showMarkers(), () => this.marker(this.eintraege.marker()));
    });
    effect(() => {
      this.put('geteilteFunde', this.map.showSharedFinds(), () => this.shared(this.eintraege.shared()));
    });
    // Eigene Funde liegen immer: sie sind der Grund, warum jemand eintraegt.
    effect(() => {
      this.put('funde', true, () => this.finds(this.eintraege.finds()));
    });
  }

  private put(layer: ObjectLayer, visible: boolean, create: () => FeatureCollection): void {
    if (!visible) {
      this.adapter.hideObjects(layer);
      return;
    }
    this.adapter.showObjects(layer, create());
  }

  private zones(zones: readonly Zone[]): FeatureCollection {
    return collection(
      zones.map((zone) => ({
        type: 'Feature',
        geometry: zone.polygon,
        properties: { id: zone.id, farbe: colorHex(zone.farbe) },
      })),
    );
  }

  private marker(marker: readonly Marker[]): FeatureCollection {
    return collection(
      marker.map((entry) => point(entry.id, entry.lon, entry.lat, { farbe: colorHex(entry.farbe) })),
    );
  }

  private finds(finds: readonly Find[]): FeatureCollection {
    return collection(finds.map((fund) => point(fund.id, fund.lon, fund.lat, { farbe: OWN_FIND })));
  }

  /**
   * Nur fremde geteilte Funde: die eigenen liegen schon exakt auf der Ebene
   * darüber und stünden sonst zweimal da, einmal davon gerundet.
   */
  private shared(finds: readonly SharedFind[]): FeatureCollection {
    return collection(
      finds
        .filter((fund) => !fund.eigen)
        .map((fund) => point(fund.id, fund.lon, fund.lat, { farbe: FOREIGN_FIND, gerundet: fund.gerundet })),
    );
  }

  private open(layer: ObjectLayer, id: string): void {
    const art: ObjectKind | null =
      layer === 'zonen' ? 'zone' : layer === 'marker' ? 'marker' : layer === 'funde' ? 'fund' : null;
    if (art === null) return;
    this.map.object.set({ art, id });
  }
}
