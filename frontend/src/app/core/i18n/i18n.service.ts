import { Injectable, computed, signal } from '@angular/core';
import { CATALOG, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type TranslationKey } from './translations';

const SPEICHER_SCHLUESSEL = 'pilzkarte.sprache';

/**
 * Die Sprache der Oberfläche als Signal. Quelle in dieser Reihenfolge:
 * gespeicherte Wahl, Browser, Deutsch. Fehlt ein Schlüssel in der aktiven
 * Sprache, greift Deutsch.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _locale = signal<Locale>(this.ersteSprache());

  readonly locale = this._locale.asReadonly();
  readonly locales = SUPPORTED_LOCALES;

  /** Das aktive Wörterbuch, damit Vorlagen auf den Wechsel reagieren. */
  readonly dictionary = computed(() => CATALOG[this._locale()]);

  constructor() {
    document.documentElement.lang = this._locale();
  }

  setLocale(locale: Locale): void {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    this._locale.set(locale);
    this.speichere(locale);
    document.documentElement.lang = locale;
  }

  /** Übersetzt einen Schlüssel. `{name}` im Text wird aus `params` gefüllt. */
  translate(key: TranslationKey, params?: Record<string, string | number>): string {
    const text = CATALOG[this._locale()][key] || CATALOG[DEFAULT_LOCALE][key];
    return params ? this.fuelle(text, params) : text;
  }

  private fuelle(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (treffer, name: string) =>
      name in params ? String(params[name]) : treffer,
    );
  }

  private ersteSprache(): Locale {
    const gespeichert = this.lies();
    if (gespeichert) return gespeichert;
    const browser = navigator.language.slice(0, 2).toLowerCase();
    return this.istLocale(browser) ? browser : DEFAULT_LOCALE;
  }

  private istLocale(wert: string): wert is Locale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(wert);
  }

  private lies(): Locale | null {
    try {
      const wert = localStorage.getItem(SPEICHER_SCHLUESSEL);
      return wert !== null && this.istLocale(wert) ? wert : null;
    } catch {
      // Der Browser kann den Speicher sperren. Dann führt die Browsersprache.
      return null;
    }
  }

  private speichere(locale: Locale): void {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, locale);
    } catch {
      // Ohne Speicher bleibt die Wahl nur für diese Sitzung.
    }
  }
}
