import { Injectable, computed, signal } from '@angular/core';

export type ThemeChoice = 'hell' | 'dunkel' | 'system';
export type EffectiveTheme = 'hell' | 'dunkel';

const STORAGE_KEY = 'pilzkarte.theme';

/** Das ui-kit erwartet `data-theme="light|dark"` auf `<html>`. */
const AS_ATTRIBUTE: Record<EffectiveTheme, string> = { hell: 'light', dunkel: 'dark' };

/**
 * Hell, dunkel oder System. Die Wahl wird gespeichert und beim Start wieder
 * angewendet. Unter „System“ folgt die App dem Betriebssystem live.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly medium = matchMedia('(prefers-color-scheme: dark)');
  private readonly _choice = signal<ThemeChoice>(this.read());
  private readonly _systemDark = signal(this.medium.matches);

  readonly choice = this._choice.asReadonly();

  /** Das Theme, das gerade sichtbar ist. */
  readonly effective = computed<EffectiveTheme>(() => {
    const choice = this._choice();
    if (choice === 'system') return this._systemDark() ? 'dunkel' : 'hell';
    return choice;
  });

  /** Einmal beim Start rufen: hängt den Systemhorcher ein und färbt die Seite. */
  init(): void {
    this.medium.addEventListener('change', this.onSystemChange);
    this.flip();
  }

  setChoice(choice: ThemeChoice): void {
    this._choice.set(choice);
    this.save(choice);
    this.flip();
  }

  private readonly onSystemChange = (event: MediaQueryListEvent): void => {
    this._systemDark.set(event.matches);
    if (this._choice() === 'system') this.flip();
  };

  private flip(): void {
    document.documentElement.setAttribute('data-theme', AS_ATTRIBUTE[this.effective()]);
  }

  private read(): ThemeChoice {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'hell' || value === 'dunkel' || value === 'system') return value;
    } catch {
      // Gesperrter Speicher ist kein Fehler, dann führt das System.
    }
    return 'system';
  }

  private save(choice: ThemeChoice): void {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Ohne Speicher gilt die Wahl nur für diese Sitzung.
    }
  }
}
