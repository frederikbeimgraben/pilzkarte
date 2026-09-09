import { InjectionToken } from '@angular/core';

/**
 * Wurzel der eigenen API. Lokal führt `proxy.conf.json` sie auf den
 * Entwicklungs-Server; im Betrieb liegt sie hinter demselben Ursprung.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
