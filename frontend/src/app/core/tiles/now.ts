import { InjectionToken } from '@angular/core';

/**
 * Der Zeitpunkt „jetzt“ als Abhängigkeit.
 *
 * Die Karte öffnet auf der laufenden Kalenderwoche. Ein Test, der das prüft,
 * braucht ein festes Heute; die Uhr des Rechners global zu verstellen träfe
 * alles andere mit.
 */
export const NOW = new InjectionToken<() => Date>('Now', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
