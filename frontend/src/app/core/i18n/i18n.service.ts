import { Injectable, computed, signal } from '@angular/core';
import { CATALOG, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type TranslationKey } from './translations';

const STORAGE_KEY = 'pilzkarte.sprache';

/** Deutsch, Englisch oder das, was der Browser sagt. */
export type LanguageChoice = Locale | 'system';

/**
 * Die Texte aus der Datenbank, je Sprache ein Wörterbuch. Sie tragen dieselben
 * Schlüssel wie der eingebaute Katalog und stechen ihn aus.
 */
export type LoadedTexts = Readonly<Partial<Record<Locale, Readonly<Record<string, string>>>>>;

export const LANGUAGE_CHOICES: readonly LanguageChoice[] = ['de', 'en', 'system'];

/**
 * Die Sprache der Oberfläche als Signal.
 *
 * Gewählt wird zwischen Deutsch, Englisch und dem Browser. Ohne Wahl führt der
 * Browser, wie vorher auch. Wer die Wahl trifft, behält sie: ein englischer
 * Browser macht aus der App sonst eine halb übersetzte Seite, weil die Texte
 * des Artenkatalogs deutsch bleiben. Fehlt ein Schlüssel in der aktiven
 * Sprache, greift Deutsch.
 *
 * Die Texte selbst stehen in der Datenbank. `TextCatalogService` holt sie und
 * reicht sie mit {@link useTexts} herein; der eingebaute Katalog bleibt der
 * Rückfall für den ersten Start und für den Betrieb ohne Netz. Der Dienst holt
 * sie nicht selbst: der Weg dorthin führt über den `ApiClient`, und der
 * braucht wiederum diesen Dienst für seine Fehlermeldungen.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _choice = signal<LanguageChoice>(this.read() ?? 'system');
  private readonly _texts = signal<LoadedTexts>({});

  readonly choice = this._choice.asReadonly();
  readonly locale = computed<Locale>(() => {
    const choice = this._choice();
    return choice === 'system' ? this.browserLanguage() : choice;
  });
  readonly locales = SUPPORTED_LOCALES;

  /** Das aktive Wörterbuch, damit Vorlagen auf den Wechsel reagieren. */
  readonly dictionary = computed<Record<string, string>>(() => ({
    ...CATALOG[this.locale()],
    ...this._texts()[this.locale()],
  }));

  constructor() {
    this.flip();
  }

  /** Übernimmt die Texte aus der Datenbank. Sie wirken sofort. */
  useTexts(texts: LoadedTexts): void {
    this._texts.set(texts);
  }

  setChoice(choice: LanguageChoice): void {
    if (!LANGUAGE_CHOICES.includes(choice)) return;
    this._choice.set(choice);
    this.save(choice);
    this.flip();
  }

  setLocale(locale: Locale): void {
    this.setChoice(locale);
  }

  /** Übersetzt einen Schlüssel. `{name}` im Text wird aus `params` gefüllt. */
  translate(key: TranslationKey, params?: Record<string, string | number>): string {
    const text = this.dictionary()[key] || CATALOG[DEFAULT_LOCALE][key];
    return params ? this.fill(text, params) : text;
  }

  private fill(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (matches, name: string) =>
      name in params ? String(params[name]) : matches,
    );
  }

  /** Das Dokument trägt die Sprache, für Vorleser und für die Silbentrennung. */
  private flip(): void {
    document.documentElement.lang = this.locale();
  }

  private browserLanguage(): Locale {
    const browser = navigator.language.slice(0, 2).toLowerCase();
    return this.isLocale(browser) ? browser : DEFAULT_LOCALE;
  }

  private isLocale(value: string): value is Locale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(value);
  }

  private isChoice(value: string): value is LanguageChoice {
    return (LANGUAGE_CHOICES as readonly string[]).includes(value);
  }

  private read(): LanguageChoice | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value !== null && this.isChoice(value) ? value : null;
    } catch {
      // Der Browser kann den Speicher sperren. Dann führt die Browsersprache.
      return null;
    }
  }

  private save(choice: LanguageChoice): void {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Ohne Speicher bleibt die Wahl nur für diese Sitzung.
    }
  }
}
