import { Injectable, inject, signal } from '@angular/core';
import { ArtenApi } from '../../core/api/arten.api';
import type { ProblemDetail } from '../../core/api/problem';
import type { Art, ArtenListe } from '../../core/api/models';

/**
 * Der Katalog im Speicher. Die Liste hängt an keiner Seite: sie wird einmal
 * geladen und überlebt den Wechsel zwischen Liste und Artseite. Profile kommen
 * je Slug dazu und bleiben ebenso liegen.
 */
@Injectable({ providedIn: 'root' })
export class ArtenZustand {
  private readonly api = inject(ArtenApi);
  private readonly laeuft = new Set<string>();

  private readonly _liste = signal<ArtenListe | null>(null);
  private readonly _profile = signal<ReadonlyMap<string, Art>>(new Map());
  private readonly _unbekannt = signal<ReadonlySet<string>>(new Set());
  private readonly _aktiveArt = signal<string | null>(null);

  readonly liste = this._liste.asReadonly();
  readonly profile = this._profile.asReadonly();
  /** Slugs, die das Backend mit 404 beantwortet hat. */
  readonly unbekannt = this._unbekannt.asReadonly();
  /**
   * Die Art, die die Karte zeigt. Bis A2 den Kartenzustand liefert, ist dieses
   * Signal die einzige Quelle; danach spiegelt es ihn.
   */
  readonly aktiveArt = this._aktiveArt.asReadonly();

  ladeListe(): void {
    if (this._liste() !== null || !this.beginne('liste')) return;
    this.api.liste().subscribe({
      next: (liste) => {
        this._liste.set(liste);
        this.laeuft.delete('liste');
      },
      error: () => this.laeuft.delete('liste'),
    });
  }

  ladeProfil(slug: string): void {
    if (this._profile().has(slug) || this._unbekannt().has(slug) || !this.beginne(slug)) return;
    this.api.profil(slug).subscribe({
      next: (art) => {
        this._profile.update((alt) => new Map(alt).set(slug, art));
        this.laeuft.delete(slug);
      },
      error: (fehler: ProblemDetail) => {
        // Ein 404 ist kein Ausfall, sondern eine Antwort: die Art gibt es nicht.
        if (fehler.status === 404) this._unbekannt.update((alt) => new Set(alt).add(slug));
        this.laeuft.delete(slug);
      },
    });
  }

  waehle(slug: string | null): void {
    this._aktiveArt.set(slug);
  }

  /** Verhindert, dass zwei Aufrufe dieselbe Anfrage doppelt stellen. */
  private beginne(schluessel: string): boolean {
    if (this.laeuft.has(schluessel)) return false;
    this.laeuft.add(schluessel);
    return true;
  }
}
