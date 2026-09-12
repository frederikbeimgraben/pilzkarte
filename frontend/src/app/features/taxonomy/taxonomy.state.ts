import { Injectable, inject, signal } from '@angular/core';
import { TaxonomyApi } from '../../core/api/taxonomy.api';
import type { ProblemDetail } from '../../core/api/problem';
import type { Taxon, TaxonRank } from '../../core/api/models';

/** Der Schlüssel einer Stufe im Speicher. Rang und Slug zusammen sind eindeutig. */
function keyOf(rank: TaxonRank, slug: string): string {
  return `${rank}/${slug}`;
}

/**
 * Die geladenen Stufen der Einordnung. Sie bleiben liegen: der Weg von der
 * Gattung zur Familie und zurück ist ein häufiger, und er soll ohne zweite
 * Anfrage gehen.
 */
@Injectable({ providedIn: 'root' })
export class TaxonomyState {
  private readonly api = inject(TaxonomyApi);
  private readonly running = new Set<string>();

  private readonly _taxa = signal<ReadonlyMap<string, Taxon>>(new Map());
  private readonly _unknown = signal<ReadonlySet<string>>(new Set());

  readonly taxa = this._taxa.asReadonly();
  /** Was das Backend mit 404 beantwortet hat. */
  readonly unknown = this._unknown.asReadonly();

  load(rank: TaxonRank, slug: string): void {
    const key = keyOf(rank, slug);
    if (this._taxa().has(key) || this._unknown().has(key) || this.running.has(key)) return;
    this.running.add(key);
    this.api.taxon(rank, slug).subscribe({
      next: (taxon) => {
        this._taxa.update((alt) => new Map(alt).set(key, taxon));
        this.running.delete(key);
      },
      error: (failure: ProblemDetail) => {
        // Ein 404 ist kein Ausfall, sondern eine Antwort: die Stufe gibt es nicht.
        if (failure.status === 404) this._unknown.update((alt) => new Set(alt).add(key));
        this.running.delete(key);
      },
    });
  }

  taxonOf(rank: TaxonRank, slug: string): Taxon | null {
    return this._taxa().get(keyOf(rank, slug)) ?? null;
  }

  isUnknown(rank: TaxonRank, slug: string): boolean {
    return this._unknown().has(keyOf(rank, slug));
  }
}
