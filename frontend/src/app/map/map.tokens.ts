import { InjectionToken, type Provider } from '@angular/core';
import { MapLibreAdapter, type MapAdapter } from './map-adapter';
import { createWorker } from './value-worker';
import type { ColorizeWorker } from './value-protocol';

/** Die Karte hinter der Schnittstelle; im Test eine Attrappe ohne WebGL. */
export const MAP_ADAPTER = new InjectionToken<MapAdapter>('KarteAdapter');

/** Baut den Färbe-Worker; im Test eine Attrappe ohne echten Faden. */
export const VALUE_WORKER = new InjectionToken<() => ColorizeWorker>('WertArbeiter');

/**
 * MapLibre wird erst geladen, wenn die Karte aufgeht. So bleibt es ein eigenes
 * Paket und liegt nicht im ersten Bündel.
 */
export const MAP_PROVIDERS: Provider[] = [
  { provide: MAP_ADAPTER, useFactory: () => new MapLibreAdapter(() => import('maplibre-gl')) },
  { provide: VALUE_WORKER, useValue: createWorker },
];
