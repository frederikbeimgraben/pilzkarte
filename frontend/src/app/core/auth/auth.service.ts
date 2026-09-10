import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { User, UserManager } from 'oidc-client-ts';
import { ConfigService } from '../config/config.service';
import { USER_MANAGER_FABRIK } from './oidc';

/** Die angemeldete Person, so wie sie im ID-Token steht. */
export interface AngemeldeterNutzer {
  sub: string;
  name: string;
  email: string;
}

/** Rückkehr vom SSO. Steht in `docs/sso-authentik.md` als Redirect URI. */
export const ANMELDUNG_PFAD = '/anmeldung';

/** Rückkehr der stillen Erneuerung, im iframe. */
export const STILL_PFAD = '/anmeldung/still';

/** Ohne `offline_access` gäbe es kein Refresh-Token und keine stille Erneuerung. */
const SCOPE = 'openid email profile offline_access';

/** Ein Abmelden gilt für den Tab, sonst holte die stille Erneuerung die Sitzung zurück. */
const ABGEMELDET_SCHLUESSEL = 'pilzkarte.abgemeldet';

/** Was im OIDC-`state` über den Umweg zum SSO mitreist. */
interface AnmeldeZustand {
  zurueck: string;
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
  private readonly fabrik = inject(USER_MANAGER_FABRIK);
  private readonly router = inject(Router);

  private manager: Promise<UserManager | null> | null = null;
  private erneuerung: Promise<string | null> | null = null;
  /** Wer auf die Antwort des Anmelde-Blatts wartet. */
  private wartende: ((angemeldet: boolean) => void)[] = [];

  private readonly _nutzer = signal<AngemeldeterNutzer | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _laedtSchon = signal(false);
  private readonly _blattOffen = signal(false);

  readonly nutzer = this._nutzer.asReadonly();
  /** Wahr, solange eine Anmeldung oder eine Erneuerung läuft. */
  readonly laedtSchon = this._laedtSchon.asReadonly();
  /** Das Anmelde-Blatt liegt über der Karte. */
  readonly blattOffen = this._blattOffen.asReadonly();
  readonly angemeldet = computed(() => this._nutzer() !== null);

  /** Das Access-Token der laufenden Sitzung, ohne Netzweg. */
  token(): string | null {
    return this._token();
  }

  /**
   * Holt eine Sitzung zurück, die beim SSO noch steht. Läuft beim Start im
   * Hintergrund; ein Fehler heißt nur: niemand ist angemeldet.
   */
  async sitzungWiederherstellen(): Promise<void> {
    // Auf den Callback-Routen führt die Route selbst; eine zweite stille
    // Anfrage daneben verbrauchte denselben Zustand ein zweites Mal.
    if (location.pathname.startsWith(ANMELDUNG_PFAD) || this.abgemeldet()) return;
    await this.stilleErneuerung();
  }

  /**
   * Führt zum SSO. Die Seite verlässt die App und kehrt auf {@link ANMELDUNG_PFAD}
   * zurück, von dort auf `zurueck`.
   */
  async anmelden(zurueck = this.router.url): Promise<void> {
    const manager = await this.managerHolen();
    if (manager === null) return;
    this.merkeAbmeldung(false);
    this._laedtSchon.set(true);
    const zustand: AnmeldeZustand = { zurueck };
    try {
      await manager.signinRedirect({ state: zustand });
    } catch (fehler) {
      // Kommt die Umleitung nicht zustande, bleibt die App bedienbar, statt
      // mit einem laufenden Ladezustand stehen zu bleiben.
      this._laedtSchon.set(false);
      throw fehler;
    }
  }

  /**
   * Verarbeitet die Rückkehr vom SSO und liefert die Route, auf der die
   * Anmeldung begonnen hat.
   */
  async anmeldungAbschliessen(): Promise<string> {
    const manager = await this.managerHolen();
    if (manager === null) return '/';
    this._laedtSchon.set(true);
    try {
      const nutzer = await manager.signinRedirectCallback();
      this.uebernimm(nutzer);
      return this.zielAus(nutzer.state);
    } finally {
      this._laedtSchon.set(false);
    }
  }

  /** Der iframe der stillen Erneuerung meldet sich hier beim Fenster zurück. */
  async stillenCallbackVerarbeiten(): Promise<void> {
    const manager = await this.managerHolen();
    await manager?.signinSilentCallback();
  }

  /**
   * Erneuert das Token still. Mehrere Aufrufer teilen sich einen Versuch,
   * sonst öffnete jede 401 einen eigenen iframe.
   */
  async stilleErneuerung(): Promise<string | null> {
    this.erneuerung ??= this.erneuere();
    try {
      return await this.erneuerung;
    } finally {
      this.erneuerung = null;
    }
  }

  /**
   * Meldet lokal ab. Die Sitzung beim SSO bleibt: Authentik nimmt nur die
   * Redirect URIs aus dem Blueprint an, eine Abmelde-URL steht nicht darunter.
   * Die Merkung verhindert, dass die stille Erneuerung sofort zurückholt, was
   * gerade abgemeldet wurde.
   */
  async abmelden(): Promise<void> {
    const manager = await this.managerHolen();
    await manager?.removeUser();
    this.merkeAbmeldung(true);
    this.uebernimm(null);
  }

  /**
   * Fragt nach einer Anmeldung, wenn etwas gespeichert werden soll. Wer schon
   * angemeldet ist, bekommt sofort `true`. Sonst öffnet das Anmelde-Blatt:
   * „Später“ antwortet mit `false`, der Weg zum SSO verlässt die Seite.
   */
  async anmeldungAnfordern(): Promise<boolean> {
    if (this.angemeldet()) return true;
    this._blattOffen.set(true);
    return new Promise<boolean>((antworte) => this.wartende.push(antworte));
  }

  /** Das Anmelde-Blatt: „Später anmelden, Eintrag lokal behalten“. */
  spaeter(): void {
    this._blattOffen.set(false);
    this.antworte(false);
  }

  private async erneuere(): Promise<string | null> {
    const manager = await this.managerHolen();
    if (manager === null) return null;
    this._laedtSchon.set(true);
    try {
      const nutzer = await manager.signinSilent();
      this.uebernimm(nutzer);
      return this._token();
    } catch {
      // Keine Sitzung mehr beim SSO. Das ist der Normalfall beim Start.
      this.uebernimm(null);
      return null;
    } finally {
      this._laedtSchon.set(false);
    }
  }

  private managerHolen(): Promise<UserManager | null> {
    this.manager ??= this.baue();
    return this.manager;
  }

  /**
   * Ohne Konfiguration gibt es keinen Issuer und damit keine Anmeldung. Das
   * ist kein Fehler: die Karte läuft auch dann.
   */
  private async baue(): Promise<UserManager | null> {
    const konfig = this.config.konfiguration();
    if (konfig === null || konfig.oidcIssuer === '') return null;
    const manager = await this.fabrik({
      authority: konfig.oidcIssuer,
      client_id: konfig.oidcClientId,
      redirect_uri: `${konfig.origin}${ANMELDUNG_PFAD}`,
      silent_redirect_uri: `${konfig.origin}${STILL_PFAD}`,
      post_logout_redirect_uri: konfig.origin,
      response_type: 'code',
      scope: SCOPE,
      automaticSilentRenew: true,
      // Authentik legt Name und E-Mail ins ID-Token. Ein zweiter Gang zum
      // UserInfo-Endpunkt brächte dieselben Werte.
      loadUserInfo: false,
    });
    manager.events.addUserLoaded((nutzer: User) => {
      this.uebernimm(nutzer);
    });
    manager.events.addUserUnloaded(() => {
      this.uebernimm(null);
    });
    return manager;
  }

  /** Ein abgelaufenes Token zählt wie keines: der nächste Schritt erneuert. */
  private uebernimm(nutzer: User | null): void {
    if (nutzer === null || nutzer.expired === true) {
      this._nutzer.set(null);
      this._token.set(null);
      return;
    }
    const profil = nutzer.profile;
    this._nutzer.set({
      sub: profil.sub,
      name: profil.name ?? profil.preferred_username ?? profil.email ?? profil.sub,
      email: profil.email ?? '',
    });
    this._token.set(nutzer.access_token);
    this._blattOffen.set(false);
    this.antworte(true);
  }

  private antworte(angemeldet: boolean): void {
    const wartende = this.wartende;
    this.wartende = [];
    for (const antworte of wartende) antworte(angemeldet);
  }

  private zielAus(zustand: unknown): string {
    if (typeof zustand === 'object' && zustand !== null && 'zurueck' in zustand) {
      const zurueck = (zustand as AnmeldeZustand).zurueck;
      // Nur eigene Wege: eine fremde URL im Zustand führte die App aus der App.
      if (typeof zurueck === 'string' && zurueck.startsWith('/') && !zurueck.startsWith('//')) return zurueck;
    }
    return '/';
  }

  private abgemeldet(): boolean {
    try {
      return sessionStorage.getItem(ABGEMELDET_SCHLUESSEL) === 'ja';
    } catch {
      // Gesperrter Speicher heißt: der Tab weiß nichts von einem Abmelden.
      return false;
    }
  }

  private merkeAbmeldung(abgemeldet: boolean): void {
    try {
      if (abgemeldet) sessionStorage.setItem(ABGEMELDET_SCHLUESSEL, 'ja');
      else sessionStorage.removeItem(ABGEMELDET_SCHLUESSEL);
    } catch {
      // Ohne Speicher gilt das Abmelden nur bis zum nächsten Reload.
    }
  }
}
