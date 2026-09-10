import { Injectable, inject, signal, type WritableSignal } from '@angular/core';
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
  private readonly _verwechslungen = signal<ArtenListe | null>(null);
  private readonly _alle = signal<ArtenListe | null>(null);
  private readonly _profile = signal<ReadonlyMap<string, Art>>(new Map());
  private readonly _unbekannt = signal<ReadonlySet<string>>(new Set());
  private readonly _aktiveArt = signal<string | null>(null);
  private readonly _origin = signal<{ slug: string; name: string } | null>(null);

  readonly liste = this._liste.asReadonly();
  /** Die nicht sammelbaren Profile. Sie kommen erst, wenn jemand sie sucht. */
  readonly verwechslungen = this._verwechslungen.asReadonly();
  /** Beide Töpfe zusammen, für die Suche über den ganzen Katalog. */
  readonly alle = this._alle.asReadonly();
  readonly profile = this._profile.asReadonly();
  /** Slugs, die das Backend mit 404 beantwortet hat. */
  readonly unbekannt = this._unbekannt.asReadonly();
  /**
   * Die Art, die die Karte zeigt. Bis A2 den Kartenzustand liefert, ist dieses
   * Signal die einzige Quelle; danach spiegelt es ihn.
   */
  readonly aktiveArt = this._aktiveArt.asReadonly();
  readonly origin = this._origin.asReadonly();

  ladeListe(): void {
    this.hole('liste', this._liste, undefined);
  }

  /** Die nicht sammelbaren Profile, für den Chip „Giftig und Verwechslung“. */
  ladeVerwechslungen(): void {
    this.hole('verwechslungen', this._verwechslungen, { sammelbar: false });
  }

  /** Beide Töpfe, sobald jemand über den ganzen Katalog sucht. */
  ladeAlle(): void {
    this.hole('alle', this._alle, { alle: true });
  }

  private hole(
    schluessel: string,
    ziel: WritableSignal<ArtenListe | null>,
    abfrage: { sammelbar?: boolean; alle?: boolean } | undefined,
  ): void {
    if (ziel() !== null || !this.beginne(schluessel)) return;
    this.api.liste(abfrage).subscribe({
      next: (liste) => {
        ziel.set(liste);
        this.laeuft.delete(schluessel);
      },
      error: () => this.laeuft.delete(schluessel),
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

  /**
   * Woher der Sprung auf ein Verwechslungsprofil kam. Diese Profile stehen im
   * Katalog, weil eine sammelbare Art ihnen ähnlich sieht; von dort führt der
   * Rückweg zurück zu genau dieser Art.
   */
  setOrigin(art: { slug: string; name: string } | null): void {
    this._origin.set(art);
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
