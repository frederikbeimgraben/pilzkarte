import { computed, signal, type Provider } from '@angular/core';
import { AuthService, type SignedInUser } from '../core/auth';

/**
 * Ein Auth-Dienst ohne SSO: der Test sagt, wer angemeldet ist und wie das
 * Anmelde-Blatt antwortet.
 */
export class AuthStub {
  readonly user = signal<SignedInUser | null>({
    sub: 'sub-eins',
    name: 'Frederik',
    email: 'frederik@beimgraben.net',
  });
  readonly signedIn = computed(() => this.user() !== null);
  /** Wahr, solange eine stille Anmeldung läuft. */
  readonly busy = signal(false);
  /** Die Antwort auf `anmeldungAnfordern`. */
  reply = true;
  asked = 0;

  requestSignIn(): Promise<boolean> {
    this.asked += 1;
    return Promise.resolve(this.reply);
  }
}

/** Hängt den Stummel an die Stelle des echten Dienstes. */
export function authStubProviders(stub: AuthStub): Provider[] {
  return [{ provide: AuthService, useValue: stub }];
}
