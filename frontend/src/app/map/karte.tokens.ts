import { InjectionToken, type Provider } from '@angular/core';
import { MapLibreAdapter, type MapAdapter } from './map-adapter';
import { baueArbeiter } from './wert-arbeiter';
import type { FaerbeArbeiter } from './wert-protokoll';

/** Die Karte hinter der Schnittstelle; im Test eine Attrappe ohne WebGL. */
export const KARTE_ADAPTER = new InjectionToken<MapAdapter>('KarteAdapter');

/** Baut den Färbe-Worker; im Test eine Attrappe ohne echten Faden. */
export const WERT_ARBEITER = new InjectionToken<() => FaerbeArbeiter>('WertArbeiter');

/**
 * MapLibre wird erst geladen, wenn die Karte aufgeht. So bleibt es ein eigenes
 * Paket und liegt nicht im ersten Bündel.
 */
export const KARTE_ANBIETER: Provider[] = [
  { provide: KARTE_ADAPTER, useFactory: () => new MapLibreAdapter(() => import('maplibre-gl')) },
  { provide: WERT_ARBEITER, useValue: baueArbeiter },
];
