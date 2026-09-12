import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TextsApi } from '../api/texts.api';
import type { TextEntry } from '../api/models';
import { I18nService, type LoadedTexts } from './i18n.service';
import type { Locale } from './translations';

const STORAGE_KEY = 'pilzkarte.texte';

/** Aus den Einträgen wird je Sprache ein Wörterbuch für den `I18nService`. */
export function textsOf(entries: readonly TextEntry[]): LoadedTexts {
  const texts: Partial<Record<Locale, Record<string, string>>> = {};
  for (const entry of entries) {
    for (const [locale, value] of Object.entries(entry.values) as [Locale, string][]) {
      (texts[locale] ??= {})[entry.key] = value;
    }
  }
  return texts;
}

/**
 * Der Katalog der Oberflächentexte aus der Datenbank.
 *
 * Beim Start liegt zuerst der zuletzt geholte Katalog aus dem lokalen Speicher
 * an: Er steht ohne Netzweg bereit und trägt auch offline. Danach fragt der
 * Dienst den Server. Bleibt die Antwort aus, ändert sich nichts, und die App
 * läuft mit dem, was sie hat — im schlimmsten Fall mit dem Katalog, der im
 * Paket steckt.
 *
 * Eine Änderung aus der Verwaltung geht denselben Weg zurück: Der Server
 * antwortet mit dem neuen Eintrag, der Dienst legt ihn ab, und die Oberfläche
 * schreibt sich ohne Neuladen um.
 */
@Injectable({ providedIn: 'root' })
export class TextCatalogService {
  private readonly api = inject(TextsApi);
  private readonly i18n = inject(I18nService);

  private readonly _entries = signal<readonly TextEntry[]>([]);

  readonly entries = this._entries.asReadonly();
  /** Die Bereiche der Schlüssel: alles vor dem ersten Punkt, ohne Doppel. */
  readonly areas = computed<readonly string[]>(() => [
    ...new Set(this._entries().map((entry) => areaOf(entry.key))),
  ]);

  /** Der Katalog aus dem lokalen Speicher, noch vor dem ersten Netzweg. */
  restore(): void {
    const stored = this.read();
    // Nicht über `adopt`: was gerade gelesen wurde, muss nicht zurückgeschrieben werden.
    if (stored) this.apply(stored);
  }

  /** Holt den Katalog vom Server. Ein Fehler lässt den bisherigen stehen. */
  async load(): Promise<void> {
    try {
      const catalogue = await firstValueFrom(this.api.catalogue());
      this.adopt(catalogue.entries);
    } catch {
      // Der ApiClient hat den Fehler schon gemeldet. Ohne Server bleibt es
      // beim gespeicherten Katalog, sonst beim eingebauten.
    }
  }

  /** Setzt einen Text in einer Sprache. */
  async change(key: string, locale: Locale, value: string): Promise<void> {
    this.replace(await firstValueFrom(this.api.change(key, locale, value)));
  }

  /** Holt die Vorgabe eines Textes zurück. */
  async reset(key: string, locale: Locale): Promise<void> {
    this.replace(await firstValueFrom(this.api.reset(key, locale)));
  }

  private replace(entry: TextEntry): void {
    this.adopt(this._entries().map((known) => (known.key === entry.key ? entry : known)));
  }

  private adopt(entries: readonly TextEntry[]): void {
    this.apply(entries);
    this.write(entries);
  }

  private apply(entries: readonly TextEntry[]): void {
    this._entries.set(entries);
    this.i18n.useTexts(textsOf(entries));
  }

  private read(): readonly TextEntry[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === null ? null : (JSON.parse(raw) as TextEntry[]);
    } catch {
      // Gesperrter Speicher oder ein halber Eintrag. Dann führt der Server.
      return null;
    }
  }

  private write(entries: readonly TextEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ohne Speicher holt der nächste Start den Katalog wieder vom Server.
    }
  }
}

/** Der Bereich eines Schlüssels: `karte.legende` gehört zu `karte`. */
export function areaOf(key: string): string {
  return key.split('.')[0];
}
