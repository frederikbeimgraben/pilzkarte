import { Injectable, computed, signal } from '@angular/core';
import { CATALOG, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type TranslationKey } from './translations';

const SPEICHER_SCHLUESSEL = 'pilzkarte.sprache';

/** Deutsch, Englisch oder das, was der Browser sagt. */
export type SprachWahl = Locale | 'system';

export const SPRACH_WAHLEN: readonly SprachWahl[] = ['de', 'en', 'system'];

/**
 * Die Sprache der Oberfläche als Signal.
 *
 * Gewählt wird zwischen Deutsch, Englisch und dem Browser. Ohne Wahl führt der
 * Browser, wie vorher auch. Wer die Wahl trifft, behält sie: ein englischer
 * Browser macht aus der App sonst eine halb übersetzte Seite, weil die Texte
 * des Artenkatalogs deutsch bleiben. Fehlt ein Schlüssel in der aktiven
 * Sprache, greift Deutsch.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _wahl = signal<SprachWahl>(this.lies() ?? 'system');

  readonly wahl = this._wahl.asReadonly();
  readonly locale = computed<Locale>(() => {
    const wahl = this._wahl();
    return wahl === 'system' ? this.browserSprache() : wahl;
  });
  readonly locales = SUPPORTED_LOCALES;

  /** Das aktive Wörterbuch, damit Vorlagen auf den Wechsel reagieren. */
  readonly dictionary = computed(() => CATALOG[this.locale()]);

  constructor() {
    this.wende();
  }

  setWahl(wahl: SprachWahl): void {
    if (!SPRACH_WAHLEN.includes(wahl)) return;
    this._wahl.set(wahl);
    this.speichere(wahl);
    this.wende();
  }

  setLocale(locale: Locale): void {
    this.setWahl(locale);
  }

  /** Übersetzt einen Schlüssel. `{name}` im Text wird aus `params` gefüllt. */
  translate(key: TranslationKey, params?: Record<string, string | number>): string {
    const text = CATALOG[this.locale()][key] || CATALOG[DEFAULT_LOCALE][key];
    return params ? this.fuelle(text, params) : text;
  }

  private fuelle(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (treffer, name: string) =>
      name in params ? String(params[name]) : treffer,
    );
  }

  /** Das Dokument trägt die Sprache, für Vorleser und für die Silbentrennung. */
  private wende(): void {
    document.documentElement.lang = this.locale();
  }

  private browserSprache(): Locale {
    const browser = navigator.language.slice(0, 2).toLowerCase();
    return this.istLocale(browser) ? browser : DEFAULT_LOCALE;
  }

  private istLocale(wert: string): wert is Locale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(wert);
  }

  private istWahl(wert: string): wert is SprachWahl {
    return (SPRACH_WAHLEN as readonly string[]).includes(wert);
  }

  private lies(): SprachWahl | null {
    try {
      const wert = localStorage.getItem(SPEICHER_SCHLUESSEL);
      return wert !== null && this.istWahl(wert) ? wert : null;
    } catch {
      // Der Browser kann den Speicher sperren. Dann führt die Browsersprache.
      return null;
    }
  }

  private speichere(wahl: SprachWahl): void {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, wahl);
    } catch {
      // Ohne Speicher bleibt die Wahl nur für diese Sitzung.
    }
  }
}
