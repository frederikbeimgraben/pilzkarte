import type { Provider } from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Location } from '../features/add-entry/add-entry.state';
import { ZONE_DRAWER, type RingListener, type DrawSession } from '../features/add-entry/zone-drawer';

/** Terra Draw ohne Karte: die Sitzung merkt sich, was sie zeichnen sollte. */
export class DrawerDouble implements DrawSession {
  readonly rings: (readonly Location[])[] = [];
  stopped = 0;
  private handler: RingListener | null = null;

  showRing(ring: readonly Location[]): void {
    this.rings.push(ring);
  }

  edit(handler: RingListener): void {
    this.handler = handler;
  }

  stop(): void {
    this.stopped += 1;
  }

  /** Stellt nach, dass jemand einen Eckpunkt mit dem Finger gezogen hat. */
  drag(ring: Location[]): void {
    this.handler?.(ring);
  }
}

/** Hängt die Attrappe an die Stelle von Terra Draw. */
export function drawerProviders(double: DrawerDouble): Provider[] {
  return [{ provide: ZONE_DRAWER, useValue: () => Promise.resolve(double) }];
}

/** Eine Karte, die nur da sein muss, damit der Zeichner startet. */
export function rawMap(): MapLibreMap {
  return {} as MapLibreMap;
}
