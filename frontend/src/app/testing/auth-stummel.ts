import { computed, signal, type Provider } from '@angular/core';
import { AuthService, type AngemeldeterNutzer } from '../core/auth';

/**
 * Ein Auth-Dienst ohne SSO: der Test sagt, wer angemeldet ist und wie das
 * Anmelde-Blatt antwortet.
 */
export class AuthStummel {
  readonly nutzer = signal<AngemeldeterNutzer | null>({
    sub: 'sub-eins',
    name: 'Frederik',
    email: 'frederik@beimgraben.net',
  });
  readonly angemeldet = computed(() => this.nutzer() !== null);
  /** Die Antwort auf `anmeldungAnfordern`. */
  antwort = true;
  gefragt = 0;

  anmeldungAnfordern(): Promise<boolean> {
    this.gefragt += 1;
    return Promise.resolve(this.antwort);
  }
}

/** Hängt den Stummel an die Stelle des echten Dienstes. */
export function authStummelAnbieter(stummel: AuthStummel): Provider[] {
  return [{ provide: AuthService, useValue: stummel }];
}
