import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';

/** Was das Backend über sich und die Anmeldung verrät. `GET /api/config`. */
export interface AppKonfiguration {
  oidcIssuer: string;
  oidcClientId: string;
  origin: string;
  version: string;
}

/**
 * Die Konfiguration wird einmal beim Start geholt. Sie steht danach als Signal
 * bereit, damit die Anmeldung in E1 ohne eigenen Ladeweg auskommt.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly api = inject(ApiClient);
  private readonly _konfiguration = signal<AppKonfiguration | null>(null);

  readonly konfiguration = this._konfiguration.asReadonly();

  /**
   * Ein Fehler bleibt hier stumm: Karte, Arten und Ebenen laufen ohne Backend,
   * und der ApiClient hat den Fehler schon als Toast gezeigt.
   */
  async laden(): Promise<void> {
    try {
      this._konfiguration.set(await firstValueFrom(this.api.get<AppKonfiguration>('/config')));
    } catch {
      this._konfiguration.set(null);
    }
  }
}
