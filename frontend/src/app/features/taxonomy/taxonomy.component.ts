import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import type { Taxon, TaxonRank, TaxonStep } from '../../core/api/models';
import { TAXON_RANKS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  EmptyStateComponent,
  InfoTextComponent,
  KeyValueRowComponent,
  KeyValueTableComponent,
  ListRowComponent,
  NoteComponent,
  PageHeaderComponent,
  SpeciesRowComponent,
} from '../../ui';
import { RANK_TEXT } from './labels';
import { TaxonomyState } from './taxonomy.state';

/** Eine Zeile, die auf eine andere Stufe zeigt. */
interface StepRow {
  rank: string;
  name: string;
  latin: string | null;
  route: string;
  count: string | null;
}

/** Eine Zeile, die auf eine Art zeigt. */
interface SpeciesRow {
  slug: string;
  name: string;
  latin: string;
}

interface Viewport {
  name: string;
  latin: string | null;
  rank: string;
  description: string | null;
  path: StepRow[];
  siblings: StepRow[];
  children: StepRow[];
  species: SpeciesRow[];
  countText: string | null;
}

/**
 * Eine Stufe der Einordnung. Die Seite zeigt beides: nach außen den Weg bis zur
 * Klasse und die Nachbarn auf derselben Stufe, nach innen die untergeordneten
 * Stufen und die Arten, die unmittelbar hier hängen.
 */
@Component({
  selector: 'app-taxonomy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    EmptyStateComponent,
    InfoTextComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    ListRowComponent,
    NoteComponent,
    PageHeaderComponent,
    SpeciesRowComponent,
    TranslatePipe,
  ],
  templateUrl: './taxonomy.component.html',
  styleUrl: './taxonomy.component.scss',
})
export class TaxonomyComponent {
  private readonly state = inject(TaxonomyState);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly rank = input.required<string>();
  readonly slug = input.required<string>();

  constructor() {
    effect(() => {
      const rank = this.knownRank();
      if (rank) this.state.load(rank, this.slug());
    });
  }

  /** Ein Rang, den der Vertrag nicht kennt, führt zu keiner Anfrage. */
  protected knownRank(): TaxonRank | null {
    const asked = this.rank();
    return TAXON_RANKS.find((known) => known === asked) ?? null;
  }

  protected readonly viewport = computed<Viewport | null>(() => {
    const rank = this.knownRank();
    const taxon = rank ? this.state.taxonOf(rank, this.slug()) : null;
    return taxon ? this.create(taxon) : null;
  });

  protected readonly unknown = computed<boolean>(() => {
    const rank = this.knownRank();
    return rank === null || this.state.isUnknown(rank, this.slug());
  });

  protected back(): void {
    void this.router.navigate(['/arten']);
  }

  protected toSpecies(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  protected toStep(route: string): void {
    void this.router.navigateByUrl(route);
  }

  private create(taxon: Taxon): Viewport {
    return {
      name: taxon.name,
      // Der lateinische Name steht nur, wo er nicht schon der Name ist.
      latin: taxon.lateinisch === taxon.name ? null : taxon.lateinisch,
      rank: this.rankText(taxon.rang),
      description: taxon.beschreibung,
      path: taxon.pfad.map((step) => this.step(step, null)),
      siblings: taxon.geschwister.map((step) => this.step(step, null)),
      children: taxon.kinder.map((child) => this.step(child, child.artenZahl)),
      species: taxon.arten.map((art) => ({
        slug: art.slug,
        name: art.name,
        latin: art.lateinisch,
      })),
      countText: taxon.artenZahl
        ? this.i18n.translate('taxonomie.artenZahl', { anzahl: String(taxon.artenZahl) })
        : null,
    };
  }

  private step(step: TaxonStep, count: number | null): StepRow {
    return {
      rank: this.rankText(step.rang),
      name: step.name,
      latin: step.lateinisch === step.name ? null : step.lateinisch,
      route: `/taxonomie/${step.rang}/${step.slug}`,
      count: count === null ? null : this.i18n.translate('taxonomie.artenZahl', { anzahl: String(count) }),
    };
  }

  private rankText(rank: TaxonRank): string {
    const key: TranslationKey = RANK_TEXT[rank];
    return this.i18n.translate(key);
  }
}
