import { Directive, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Feature, FeatureCollection } from 'geojson';
import type { Fund, GeteilterFund, Marker, Zone } from '../../core/api/models';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import type { ObjektEbene } from '../../map/map-adapter';
import { EintraegeZustand } from '../eintraege/eintraege.zustand';
import { farbeHex } from '../eintraege/farben';
import { KartenZustand, schreibeObjekt, type ObjektArt } from '../karte/karten-zustand';

/**
 * Die Farben der Punkte aus `docs/mockups/bauen.py`: ein eigener Fund trägt
 * `accent4`, ein fremder geteilter das gedämpfte `info`. So sind die eigenen
 * Funde auf der Karte auf einen Blick von den fremden zu unterscheiden.
 */
const EIGENER_FUND = '#c8a25a';
const FREMDER_FUND = '#185468';

function punkt(
  id: string,
  lon: number,
  lat: number,
  eigenschaften: Record<string, string | boolean>,
): Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id, ...eigenschaften },
  };
}

function sammlung(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

/**
 * Legt die eigenen Marker, Zonen und Funde sowie die geteilten Funde auf die
 * Karte und öffnet auf einen Tipp das Objekt-Blatt.
 *
 * Was liegt, entscheiden die drei Signale des Kartenzustands; der Ebenen-Knopf
 * aus B1 schaltet dieselben Signale.
 */
@Directive({ selector: '[appKartenObjekte]' })
export class KartenObjekteDirective {
  private readonly adapter = inject(KARTE_ADAPTER);
  private readonly eintraege = inject(EintraegeZustand);
  private readonly karte = inject(KartenZustand);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    this.adapter.beiObjektAuswahl((ebene, id) => {
      this.oeffne(ebene, id);
    });

    effect(() => {
      this.lege('zonen', this.karte.zeigeZonen(), () => this.zonen(this.eintraege.zonen()));
    });
    effect(() => {
      this.lege('marker', this.karte.zeigeMarker(), () => this.marker(this.eintraege.marker()));
    });
    effect(() => {
      this.lege('geteilteFunde', this.karte.zeigeGeteilteFunde(), () =>
        this.geteilte(this.eintraege.geteilte()),
      );
    });
    // Eigene Funde liegen immer: sie sind der Grund, warum jemand eintraegt.
    effect(() => {
      this.lege('funde', true, () => this.funde(this.eintraege.funde()));
    });
  }

  private lege(ebene: ObjektEbene, sichtbar: boolean, baue: () => FeatureCollection): void {
    if (!sichtbar) {
      this.adapter.verbergeObjekte(ebene);
      return;
    }
    this.adapter.zeigeObjekte(ebene, baue());
  }

  private zonen(zonen: readonly Zone[]): FeatureCollection {
    return sammlung(
      zonen.map((zone) => ({
        type: 'Feature',
        geometry: zone.polygon,
        properties: { id: zone.id, farbe: farbeHex(zone.farbe) },
      })),
    );
  }

  private marker(marker: readonly Marker[]): FeatureCollection {
    return sammlung(
      marker.map((eintrag) =>
        punkt(eintrag.id, eintrag.lon, eintrag.lat, { farbe: farbeHex(eintrag.farbe) }),
      ),
    );
  }

  private funde(funde: readonly Fund[]): FeatureCollection {
    return sammlung(funde.map((fund) => punkt(fund.id, fund.lon, fund.lat, { farbe: EIGENER_FUND })));
  }

  /**
   * Nur fremde geteilte Funde: die eigenen liegen schon exakt auf der Ebene
   * darüber und stünden sonst zweimal da, einmal davon gerundet.
   */
  private geteilte(funde: readonly GeteilterFund[]): FeatureCollection {
    return sammlung(
      funde
        .filter((fund) => !fund.eigen)
        .map((fund) => punkt(fund.id, fund.lon, fund.lat, { farbe: FREMDER_FUND, gerundet: fund.gerundet })),
    );
  }

  private oeffne(ebene: ObjektEbene, id: string): void {
    const art: ObjektArt | null =
      ebene === 'zonen' ? 'zone' : ebene === 'marker' ? 'marker' : ebene === 'funde' ? 'fund' : null;
    if (art === null) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { objekt: schreibeObjekt({ art, id }) },
      queryParamsHandling: 'merge',
    });
  }
}
