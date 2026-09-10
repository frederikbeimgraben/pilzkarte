import { signal, type Provider } from '@angular/core';
import type { User, UserManager, UserManagerSettings } from 'oidc-client-ts';
import { USER_MANAGER_FACTORY } from '../core/auth';
import { ConfigService, type AppConfig } from '../core/config/config.service';

/** Was `GET /api/config` in den Tests liefert. Werte aus `docs/sso-authentik.md`. */
export const CONFIG: AppConfig = {
  oidcIssuer: 'https://sso.beimgraben.net/application/o/pilze/',
  oidcClientId: 'pilze',
  origin: 'http://localhost:4200',
  version: '2026-09-09',
};

/** Felder eines Nutzers, die für die Tests eine Rolle spielen. */
export interface UserValues {
  token?: string;
  sub?: string;
  name?: string | undefined;
  username?: string;
  email?: string | undefined;
  abgelaufen?: boolean;
  state?: unknown;
}

/**
 * Ein Nutzer, wie ihn oidc-client-ts nach dem Tausch liefert. `expired` ist im
 * Original ein berechnetes Feld; hier steht es fest, damit ein Test die
 * abgelaufene Sitzung ohne Uhr nachstellen kann.
 */
export function oidcUser(values: UserValues = {}): User {
  return {
    access_token: values.token ?? 'token-eins',
    expired: values.abgelaufen ?? false,
    state: values.state,
    profile: {
      sub: values.sub ?? 'sub-eins',
      name: 'name' in values ? values.name : 'Frederik',
      preferred_username: values.username,
      email: 'email' in values ? values.email : 'frederik@beimgraben.net',
    },
  } as unknown as User;
}

/**
 * Ein `UserManager` ohne Netz. Jeder Weg zum SSO wird hier gestellt: der Test
 * legt fest, was `signinSilent` und der Callback liefern, und liest hinterher,
 * womit der Dienst umgeleitet hat.
 */
export class ManagerDouble {
  /** Womit der Dienst den Manager gebaut hat. */
  settings: UserManagerSettings | null = null;
  /** Antwort auf `signinSilent`; ein Fehler wird geworfen. */
  still: User | Error | null = null;
  /** Antwort auf `signinRedirectCallback`. */
  returnValue: User | Error = new Error('Kein Callback vorbereitet.');
  /** Fehler, den `signinRedirect` wirft, statt umzuleiten. */
  redirectError: Error | null = null;
  /** Der Zustand jeder Umleitung, in der Reihenfolge der Aufrufe. */
  readonly redirects: unknown[] = [];
  removed = 0;
  silentCallbacks = 0;
  silentAttempts = 0;

  private readonly loaded: ((user: User) => void)[] = [];
  private readonly unloaded: (() => void)[] = [];

  readonly events = {
    addUserLoaded: (callback: (user: User) => void): (() => void) => {
      this.loaded.push(callback);
      return () => undefined;
    },
    addUserUnloaded: (callback: () => void): (() => void) => {
      this.unloaded.push(callback);
      return () => undefined;
    },
  };

  signinRedirect(args?: { state?: unknown }): Promise<void> {
    if (this.redirectError !== null) return Promise.reject(this.redirectError);
    this.redirects.push(args?.state);
    return Promise.resolve();
  }

  signinRedirectCallback(): Promise<User> {
    return this.returnValue instanceof Error
      ? Promise.reject(this.returnValue)
      : Promise.resolve(this.returnValue);
  }

  signinSilent(): Promise<User | null> {
    this.silentAttempts += 1;
    return this.still instanceof Error ? Promise.reject(this.still) : Promise.resolve(this.still);
  }

  signinSilentCallback(): Promise<void> {
    this.silentCallbacks += 1;
    return Promise.resolve();
  }

  removeUser(): Promise<void> {
    this.removed += 1;
    return Promise.resolve();
  }

  /** Das Ereignis, das der echte Manager nach einer Erneuerung auslöst. */
  emitLoaded(user: User): void {
    for (const callback of this.loaded) callback(user);
  }

  emitUnloaded(): void {
    for (const callback of this.unloaded) callback();
  }

  asManager(): UserManager {
    return this as unknown as UserManager;
  }
}

/**
 * Die Anbieter für einen Test mit Anmeldung: der Manager kommt aus der
 * Attrappe, die Konfiguration ohne Netz. `konfiguration: null` stellt den Fall
 * nach, dass das Backend nicht erreichbar war.
 */
export function authProvider(manager: ManagerDouble, configuration: AppConfig | null = CONFIG): Provider[] {
  return [
    {
      provide: USER_MANAGER_FACTORY,
      useValue: (settings: UserManagerSettings) => {
        manager.settings = settings;
        return Promise.resolve(manager.asManager());
      },
    },
    {
      provide: ConfigService,
      useValue: {
        configuration: signal(configuration),
        load: () => Promise.resolve(),
      },
    },
  ];
}
