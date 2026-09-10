import { signal, type Provider } from '@angular/core';
import type { User, UserManager, UserManagerSettings } from 'oidc-client-ts';
import { USER_MANAGER_FABRIK } from '../core/auth';
import { ConfigService, type AppKonfiguration } from '../core/config/config.service';

/** Was `GET /api/config` in den Tests liefert. Werte aus `docs/sso-authentik.md`. */
export const KONFIGURATION: AppKonfiguration = {
  oidcIssuer: 'https://sso.beimgraben.net/application/o/pilze/',
  oidcClientId: 'pilze',
  origin: 'http://localhost:4200',
  version: '2026-09-09',
};

/** Felder eines Nutzers, die für die Tests eine Rolle spielen. */
export interface NutzerWerte {
  token?: string;
  sub?: string;
  name?: string | undefined;
  nutzername?: string;
  email?: string | undefined;
  abgelaufen?: boolean;
  zustand?: unknown;
}

/**
 * Ein Nutzer, wie ihn oidc-client-ts nach dem Tausch liefert. `expired` ist im
 * Original ein berechnetes Feld; hier steht es fest, damit ein Test die
 * abgelaufene Sitzung ohne Uhr nachstellen kann.
 */
export function oidcNutzer(werte: NutzerWerte = {}): User {
  return {
    access_token: werte.token ?? 'token-eins',
    expired: werte.abgelaufen ?? false,
    state: werte.zustand,
    profile: {
      sub: werte.sub ?? 'sub-eins',
      name: 'name' in werte ? werte.name : 'Frederik',
      preferred_username: werte.nutzername,
      email: 'email' in werte ? werte.email : 'frederik@beimgraben.net',
    },
  } as unknown as User;
}

/**
 * Ein `UserManager` ohne Netz. Jeder Weg zum SSO wird hier gestellt: der Test
 * legt fest, was `signinSilent` und der Callback liefern, und liest hinterher,
 * womit der Dienst umgeleitet hat.
 */
export class ManagerAttrappe {
  /** Womit der Dienst den Manager gebaut hat. */
  einstellungen: UserManagerSettings | null = null;
  /** Antwort auf `signinSilent`; ein Fehler wird geworfen. */
  still: User | Error | null = null;
  /** Antwort auf `signinRedirectCallback`. */
  rueckkehr: User | Error = new Error('Kein Callback vorbereitet.');
  /** Fehler, den `signinRedirect` wirft, statt umzuleiten. */
  redirectFehler: Error | null = null;
  /** Der Zustand jeder Umleitung, in der Reihenfolge der Aufrufe. */
  readonly umleitungen: unknown[] = [];
  entfernt = 0;
  stilleCallbacks = 0;
  stilleVersuche = 0;

  private readonly geladen: ((nutzer: User) => void)[] = [];
  private readonly entladen: (() => void)[] = [];

  readonly events = {
    addUserLoaded: (rueckruf: (nutzer: User) => void): (() => void) => {
      this.geladen.push(rueckruf);
      return () => undefined;
    },
    addUserUnloaded: (rueckruf: () => void): (() => void) => {
      this.entladen.push(rueckruf);
      return () => undefined;
    },
  };

  signinRedirect(argumente?: { state?: unknown }): Promise<void> {
    if (this.redirectFehler !== null) return Promise.reject(this.redirectFehler);
    this.umleitungen.push(argumente?.state);
    return Promise.resolve();
  }

  signinRedirectCallback(): Promise<User> {
    return this.rueckkehr instanceof Error ? Promise.reject(this.rueckkehr) : Promise.resolve(this.rueckkehr);
  }

  signinSilent(): Promise<User | null> {
    this.stilleVersuche += 1;
    return this.still instanceof Error ? Promise.reject(this.still) : Promise.resolve(this.still);
  }

  signinSilentCallback(): Promise<void> {
    this.stilleCallbacks += 1;
    return Promise.resolve();
  }

  removeUser(): Promise<void> {
    this.entfernt += 1;
    return Promise.resolve();
  }

  /** Das Ereignis, das der echte Manager nach einer Erneuerung auslöst. */
  meldeGeladen(nutzer: User): void {
    for (const rueckruf of this.geladen) rueckruf(nutzer);
  }

  meldeEntladen(): void {
    for (const rueckruf of this.entladen) rueckruf();
  }

  alsManager(): UserManager {
    return this as unknown as UserManager;
  }
}

/**
 * Die Anbieter für einen Test mit Anmeldung: der Manager kommt aus der
 * Attrappe, die Konfiguration ohne Netz. `konfiguration: null` stellt den Fall
 * nach, dass das Backend nicht erreichbar war.
 */
export function authAnbieter(
  manager: ManagerAttrappe,
  konfiguration: AppKonfiguration | null = KONFIGURATION,
): Provider[] {
  return [
    {
      provide: USER_MANAGER_FABRIK,
      useValue: (einstellungen: UserManagerSettings) => {
        manager.einstellungen = einstellungen;
        return Promise.resolve(manager.alsManager());
      },
    },
    {
      provide: ConfigService,
      useValue: {
        konfiguration: signal(konfiguration),
        laden: () => Promise.resolve(),
      },
    },
  ];
}
