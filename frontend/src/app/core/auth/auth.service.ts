import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { User, UserManager } from 'oidc-client-ts';
import { ConfigService } from '../config/config.service';
import { USER_MANAGER_FACTORY } from './oidc';

/** Die angemeldete Person, so wie sie im ID-Token steht. */
export interface SignedInUser {
  sub: string;
  name: string;
  email: string;
}

/** Rückkehr vom SSO. Steht in `docs/sso-authentik.md` als Redirect URI. */
export const SIGN_IN_PATH = '/anmeldung';

/** Rückkehr der stillen Erneuerung, im iframe. */
export const SILENT_PATH = '/anmeldung/still';

/** Ohne `offline_access` gäbe es kein Refresh-Token und keine stille Erneuerung. */
const SCOPE = 'openid email profile offline_access';

/** Ein Abmelden gilt für den Tab, sonst holte die stille Erneuerung die Sitzung zurück. */
const SIGNED_OUT_KEY = 'pilzkarte.abgemeldet';

/** Was im OIDC-`state` über den Umweg zum SSO mitreist. */
interface SignInState {
  back: string;
}

/**
 * Die Anmeldung der App: Authorization Code mit PKCE gegen den Issuer aus
 * `GET /api/config`. Lesen geht ohne Konto; gefragt wird erst, wenn etwas
 * gespeichert werden soll.
 *
 * Der Dienst hält Token und Person als Signale. Das Token steht synchron
 * bereit, damit der Interceptor keinen Netzweg je Anfrage braucht.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(ConfigService);
  private readonly factory = inject(USER_MANAGER_FACTORY);
  private readonly router = inject(Router);

  private manager: Promise<UserManager | null> | null = null;
  private renewal: Promise<string | null> | null = null;
  /** Wer auf die Antwort des Anmelde-Blatts wartet. */
  private pendingEntries: ((signedIn: boolean) => void)[] = [];

  private readonly _user = signal<SignedInUser | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _busy = signal(false);
  private readonly _sheetOpen = signal(false);

  readonly user = this._user.asReadonly();
  /** Wahr, solange eine Anmeldung oder eine Erneuerung läuft. */
  readonly busy = this._busy.asReadonly();
  /** Das Anmelde-Blatt liegt über der Karte. */
  readonly sheetOpen = this._sheetOpen.asReadonly();
  readonly signedIn = computed(() => this._user() !== null);

  /** Das Access-Token der laufenden Sitzung, ohne Netzweg. */
  token(): string | null {
    return this._token();
  }

  /**
   * Holt eine Sitzung zurück, die beim SSO noch steht. Läuft beim Start im
   * Hintergrund; ein Fehler heißt nur: niemand ist angemeldet.
   */
  async restoreSession(): Promise<void> {
    // Auf den Callback-Routen führt die Route selbst; eine zweite stille
    // Anfrage daneben verbrauchte denselben Zustand ein zweites Mal.
    if (location.pathname.startsWith(SIGN_IN_PATH) || this.signedOut()) return;
    await this.silentRenew();
  }

  /**
   * Führt zum SSO. Die Seite verlässt die App und kehrt auf {@link SIGN_IN_PATH}
   * zurück, von dort auf `zurueck`.
   */
  async signIn(back = this.router.url): Promise<void> {
    const manager = await this.getManager();
    if (manager === null) return;
    this.rememberSignOut(false);
    this._busy.set(true);
    const state: SignInState = { back };
    try {
      await manager.signinRedirect({ state: state });
    } catch (failure) {
      // Kommt die Umleitung nicht zustande, bleibt die App bedienbar, statt
      // mit einem laufenden Ladezustand stehen zu bleiben.
      this._busy.set(false);
      throw failure;
    }
  }

  /**
   * Verarbeitet die Rückkehr vom SSO und liefert die Route, auf der die
   * Anmeldung begonnen hat.
   */
  async completeSignIn(): Promise<string> {
    const manager = await this.getManager();
    if (manager === null) return '/';
    this._busy.set(true);
    try {
      const user = await manager.signinRedirectCallback();
      this.adopt(user);
      return this.targetFrom(user.state);
    } finally {
      this._busy.set(false);
    }
  }

  /** Der iframe der stillen Erneuerung meldet sich hier beim Fenster zurück. */
  async handleSilentCallback(): Promise<void> {
    const manager = await this.getManager();
    await manager?.signinSilentCallback();
  }

  /**
   * Erneuert das Token still. Mehrere Aufrufer teilen sich einen Versuch,
   * sonst öffnete jede 401 einen eigenen iframe.
   */
  async silentRenew(): Promise<string | null> {
    this.renewal ??= this.renew();
    try {
      return await this.renewal;
    } finally {
      this.renewal = null;
    }
  }

  /**
   * Meldet lokal ab. Die Sitzung beim SSO bleibt: Authentik nimmt nur die
   * Redirect URIs aus dem Blueprint an, eine Abmelde-URL steht nicht darunter.
   * Die Merkung verhindert, dass die stille Erneuerung sofort zurückholt, was
   * gerade abgemeldet wurde.
   */
  async signOut(): Promise<void> {
    const manager = await this.getManager();
    await manager?.removeUser();
    this.rememberSignOut(true);
    this.adopt(null);
  }

  /**
   * Fragt nach einer Anmeldung, wenn etwas gespeichert werden soll. Wer schon
   * angemeldet ist, bekommt sofort `true`. Sonst öffnet das Anmelde-Blatt:
   * „Später“ antwortet mit `false`, der Weg zum SSO verlässt die Seite.
   */
  async requestSignIn(): Promise<boolean> {
    if (this.signedIn()) return true;
    this._sheetOpen.set(true);
    return new Promise<boolean>((answer) => this.pendingEntries.push(answer));
  }

  /** Das Anmelde-Blatt: „Später anmelden, Eintrag lokal behalten“. */
  later(): void {
    this._sheetOpen.set(false);
    this.answer(false);
  }

  private async renew(): Promise<string | null> {
    const manager = await this.getManager();
    if (manager === null) return null;
    this._busy.set(true);
    try {
      const user = await manager.signinSilent();
      this.adopt(user);
      return this._token();
    } catch {
      // Keine Sitzung mehr beim SSO. Das ist der Normalfall beim Start.
      this.adopt(null);
      return null;
    } finally {
      this._busy.set(false);
    }
  }

  private getManager(): Promise<UserManager | null> {
    this.manager ??= this.create();
    return this.manager;
  }

  /**
   * Ohne Konfiguration gibt es keinen Issuer und damit keine Anmeldung. Das
   * ist kein Fehler: die Karte läuft auch dann.
   */
  private async create(): Promise<UserManager | null> {
    const config = this.config.configuration();
    if (config === null || config.oidcIssuer === '') return null;
    const manager = await this.factory({
      authority: config.oidcIssuer,
      client_id: config.oidcClientId,
      redirect_uri: `${config.origin}${SIGN_IN_PATH}`,
      silent_redirect_uri: `${config.origin}${SILENT_PATH}`,
      post_logout_redirect_uri: config.origin,
      response_type: 'code',
      scope: SCOPE,
      automaticSilentRenew: true,
      // Authentik legt Name und E-Mail ins ID-Token. Ein zweiter Gang zum
      // UserInfo-Endpunkt brächte dieselben Werte.
      loadUserInfo: false,
    });
    manager.events.addUserLoaded((user: User) => {
      this.adopt(user);
    });
    manager.events.addUserUnloaded(() => {
      this.adopt(null);
    });
    return manager;
  }

  /** Ein abgelaufenes Token zählt wie keines: der nächste Schritt erneuert. */
  private adopt(user: User | null): void {
    if (user === null || user.expired === true) {
      this._user.set(null);
      this._token.set(null);
      return;
    }
    const profile = user.profile;
    this._user.set({
      sub: profile.sub,
      name: profile.name ?? profile.preferred_username ?? profile.email ?? profile.sub,
      email: profile.email ?? '',
    });
    this._token.set(user.access_token);
    this._sheetOpen.set(false);
    this.answer(true);
  }

  private answer(signedIn: boolean): void {
    const pendingEntries = this.pendingEntries;
    this.pendingEntries = [];
    for (const answer of pendingEntries) answer(signedIn);
  }

  private targetFrom(state: unknown): string {
    if (typeof state === 'object' && state !== null && 'back' in state) {
      const back = (state as SignInState).back;
      // Nur eigene Wege: eine fremde URL im Zustand führte die App aus der App.
      if (typeof back === 'string' && back.startsWith('/') && !back.startsWith('//')) return back;
    }
    return '/';
  }

  private signedOut(): boolean {
    try {
      return sessionStorage.getItem(SIGNED_OUT_KEY) === 'ja';
    } catch {
      // Gesperrter Speicher heißt: der Tab weiß nichts von einem Abmelden.
      return false;
    }
  }

  private rememberSignOut(signedOut: boolean): void {
    try {
      if (signedOut) sessionStorage.setItem(SIGNED_OUT_KEY, 'ja');
      else sessionStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
      // Ohne Speicher gilt das Abmelden nur bis zum nächsten Reload.
    }
  }
}
