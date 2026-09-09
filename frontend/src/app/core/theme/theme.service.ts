import { Injectable, computed, signal } from '@angular/core';

export type ThemeWahl = 'hell' | 'dunkel' | 'system';
export type ThemeWirksam = 'hell' | 'dunkel';

const SPEICHER_SCHLUESSEL = 'pilzkarte.theme';

/** Das ui-kit erwartet `data-theme="light|dark"` auf `<html>`. */
const ALS_ATTRIBUT: Record<ThemeWirksam, string> = { hell: 'light', dunkel: 'dark' };

/**
 * Hell, dunkel oder System. Die Wahl wird gespeichert und beim Start wieder
 * angewendet. Unter „System“ folgt die App dem Betriebssystem live.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly medium = matchMedia('(prefers-color-scheme: dark)');
  private readonly _wahl = signal<ThemeWahl>(this.lies());
  private readonly _systemDunkel = signal(this.medium.matches);

  readonly wahl = this._wahl.asReadonly();

  /** Das Theme, das gerade sichtbar ist. */
  readonly wirksam = computed<ThemeWirksam>(() => {
    const wahl = this._wahl();
    if (wahl === 'system') return this._systemDunkel() ? 'dunkel' : 'hell';
    return wahl;
  });

  /** Einmal beim Start rufen: hängt den Systemhorcher ein und färbt die Seite. */
  init(): void {
    this.medium.addEventListener('change', this.beiSystemwechsel);
    this.wende();
  }

  setWahl(wahl: ThemeWahl): void {
    this._wahl.set(wahl);
    this.speichere(wahl);
    this.wende();
  }

  private readonly beiSystemwechsel = (ereignis: MediaQueryListEvent): void => {
    this._systemDunkel.set(ereignis.matches);
    if (this._wahl() === 'system') this.wende();
  };

  private wende(): void {
    document.documentElement.setAttribute('data-theme', ALS_ATTRIBUT[this.wirksam()]);
  }

  private lies(): ThemeWahl {
    try {
      const wert = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (wert === 'hell' || wert === 'dunkel' || wert === 'system') return wert;
    } catch {
      // Gesperrter Speicher ist kein Fehler, dann führt das System.
    }
    return 'system';
  }

  private speichere(wahl: ThemeWahl): void {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, wahl);
    } catch {
      // Ohne Speicher gilt die Wahl nur für diese Sitzung.
    }
  }
}
