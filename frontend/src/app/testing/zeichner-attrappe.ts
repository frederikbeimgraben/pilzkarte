import type { Provider } from '@angular/core';
import type { Map as MapLibreKarte } from 'maplibre-gl';
import type { Ort } from '../features/eintragen/eintragen.zustand';
import { ZONEN_ZEICHNER, type RingHoerer, type ZeichenSitzung } from '../features/eintragen/zonen-zeichner';

/** Terra Draw ohne Karte: die Sitzung merkt sich, was sie zeichnen sollte. */
export class ZeichnerAttrappe implements ZeichenSitzung {
  readonly ringe: (readonly Ort[])[] = [];
  beendet = 0;
  private hoerer: RingHoerer | null = null;

  zeigeRing(ring: readonly Ort[]): void {
    this.ringe.push(ring);
  }

  bearbeiten(hoerer: RingHoerer): void {
    this.hoerer = hoerer;
  }

  beende(): void {
    this.beendet += 1;
  }

  /** Stellt nach, dass jemand einen Eckpunkt mit dem Finger gezogen hat. */
  zieh(ring: Ort[]): void {
    this.hoerer?.(ring);
  }
}

/** Hängt die Attrappe an die Stelle von Terra Draw. */
export function zeichnerAnbieter(attrappe: ZeichnerAttrappe): Provider[] {
  return [{ provide: ZONEN_ZEICHNER, useValue: () => Promise.resolve(attrappe) }];
}

/** Eine Karte, die nur da sein muss, damit der Zeichner startet. */
export function roheKarte(): MapLibreKarte {
  return {} as MapLibreKarte;
}
