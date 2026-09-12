import { Injectable, inject, signal, type WritableSignal } from '@angular/core';
import { SpeciesApi } from '../../core/api/species.api';
import { SpeciesImagesApi } from '../../core/api/species-images.api';
import type { ProblemDetail } from '../../core/api/problem';
import type { Species, SpeciesCatalogue, SpeciesImage } from '../../core/api/models';

/**
 * Der Katalog im Speicher. Die Liste hängt an keiner Seite: sie wird einmal
 * geladen und überlebt den Wechsel zwischen Liste und Artseite. Profile kommen
 * je Slug dazu und bleiben ebenso liegen.
 */
@Injectable({ providedIn: 'root' })
export class SpeciesState {
  private readonly api = inject(SpeciesApi);
  private readonly imagesApi = inject(SpeciesImagesApi);
  private readonly running = new Set<string>();

  private readonly _catalogue = signal<SpeciesCatalogue | null>(null);
  private readonly _verwechslungen = signal<SpeciesCatalogue | null>(null);
  private readonly _alle = signal<SpeciesCatalogue | null>(null);
  private readonly _profile = signal<ReadonlyMap<string, Species>>(new Map());
  private readonly _unknown = signal<ReadonlySet<string>>(new Set());
  private readonly _images = signal<ReadonlyMap<string, readonly SpeciesImage[]>>(new Map());
  private readonly _activeSpecies = signal<string | null>(null);
  private readonly _origin = signal<{ slug: string; name: string } | null>(null);

  readonly catalogue = this._catalogue.asReadonly();
  /** Die nicht sammelbaren Profile. Sie kommen erst, wenn jemand sie sucht. */
  readonly verwechslungen = this._verwechslungen.asReadonly();
  /** Beide Töpfe zusammen, für die Suche über den ganzen Katalog. */
  readonly alle = this._alle.asReadonly();
  readonly profile = this._profile.asReadonly();
  /** Slugs, die das Backend mit 404 beantwortet hat. */
  readonly unknown = this._unknown.asReadonly();
  /** Die freigegebenen Bilder je Art. Ein leerer Eintrag heißt: geladen, keine Bilder. */
  readonly images = this._images.asReadonly();
  /**
   * Die Art, die die Karte zeigt. Bis A2 den Kartenzustand liefert, ist dieses
   * Signal die einzige Quelle; danach spiegelt es ihn.
   */
  readonly activeSpecies = this._activeSpecies.asReadonly();
  readonly origin = this._origin.asReadonly();

  loadCatalogue(): void {
    this.get('liste', this._catalogue, undefined);
  }

  /** Die nicht sammelbaren Profile, für den Chip „Giftig und Verwechslung“. */
  loadLookalikes(): void {
    this.get('verwechslungen', this._verwechslungen, { sammelbar: false });
  }

  /** Beide Töpfe, sobald jemand über den ganzen Katalog sucht. */
  loadAll(): void {
    this.get('alle', this._alle, { alle: true });
  }

  private get(
    schluessel: string,
    target: WritableSignal<SpeciesCatalogue | null>,
    query: { sammelbar?: boolean; alle?: boolean } | undefined,
  ): void {
    if (target() !== null || !this.begin(schluessel)) return;
    this.api.catalogue(query).subscribe({
      next: (catalogue) => {
        target.set(catalogue);
        this.running.delete(schluessel);
      },
      error: () => this.running.delete(schluessel),
    });
  }

  loadProfile(slug: string): void {
    if (this._profile().has(slug) || this._unknown().has(slug) || !this.begin(slug)) return;
    this.api.profile(slug).subscribe({
      next: (art) => {
        this._profile.update((alt) => new Map(alt).set(slug, art));
        this.running.delete(slug);
      },
      error: (failure: ProblemDetail) => {
        // Ein 404 ist kein Ausfall, sondern eine Antwort: die Art gibt es nicht.
        if (failure.status === 404) this._unknown.update((alt) => new Set(alt).add(slug));
        this.running.delete(slug);
      },
    });
  }

  /**
   * Die Bilder einer Art. Sie kommen getrennt vom Profil: das Profil liegt als
   * TOML beim Dienst, die Bilder stehen in der Datenbank.
   */
  loadImages(slug: string): void {
    const schluessel = `bilder:${slug}`;
    if (this._images().has(slug) || !this.begin(schluessel)) return;
    this.imagesApi.ofSpecies(slug).subscribe({
      next: (images) => {
        this._images.update((alt) => new Map(alt).set(slug, images));
        this.running.delete(schluessel);
      },
      error: () => this.running.delete(schluessel),
    });
  }

  /**
   * Der Name einer Art, sobald ein Katalog geladen ist. Ohne ihn bleibt nur
   * der Slug, und der steht in keiner Oberfläche.
   */
  nameOf(slug: string): string | null {
    for (const catalogue of [this.alle(), this.catalogue(), this.verwechslungen()]) {
      const found = catalogue?.arten.find((art) => art.slug === slug);
      if (found) return found.name;
    }
    return null;
  }

  /**
   * Woher der Sprung auf ein Verwechslungsprofil kam. Diese Profile stehen im
   * Katalog, weil eine sammelbare Art ihnen ähnlich sieht; von dort führt der
   * Rückweg zurück zu genau dieser Art.
   */
  setOrigin(art: { slug: string; name: string } | null): void {
    this._origin.set(art);
  }

  select(slug: string | null): void {
    this._activeSpecies.set(slug);
  }

  /** Verhindert, dass zwei Aufrufe dieselbe Anfrage doppelt stellen. */
  private begin(schluessel: string): boolean {
    if (this.running.has(schluessel)) return false;
    this.running.add(schluessel);
    return true;
  }
}
