import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ColourChangeComponent,
  ColourFieldComponent,
  ComparisonCellComponent,
  ComparisonRowComponent,
  ComparisonTableComponent,
  EmptyStateComponent,
  LevelPillComponent,
  MeasurementComponent,
  NoteComponent,
  PageHeaderComponent,
  TagListComponent,
  YearBandComponent,
} from '../../ui';
import { SpeciesState } from './species.state';
import { comparisonRows, type ComparisonRow } from './comparison';

/** Beide Arten mit Namen, plus die Zeilen dazwischen. */
interface Viewport {
  names: string[];
  label: string;
  rows: ComparisonRow[];
}

/**
 * Die Gegenüberstellung zweier Arten (Artboards 15 und 16).
 *
 * Der Weg hierher führt über die zwei gegenläufigen Pfeile an einer
 * Verwechslungszeile. Gezeigt werden die Merkmale, die eine Verwechslung
 * entscheiden, in derselben Reihenfolge wie auf der Artseite und mit denselben
 * Bausteinen: ein Maß bleibt ein Maß, eine Farbe eine Fläche.
 *
 * Getönt sind die Zeilen, in denen sich die Arten unterscheiden. Wer zwei
 * Röhrlinge in der Hand hält, sucht genau die.
 */
@Component({
  selector: 'app-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    ColourChangeComponent,
    ColourFieldComponent,
    ComparisonCellComponent,
    ComparisonRowComponent,
    ComparisonTableComponent,
    EmptyStateComponent,
    LevelPillComponent,
    MeasurementComponent,
    NoteComponent,
    PageHeaderComponent,
    TagListComponent,
    TranslatePipe,
    YearBandComponent,
  ],
  templateUrl: './comparison.component.html',
  styleUrl: './comparison.component.scss',
})
export class ComparisonComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();
  readonly andere = input.required<string>();

  private readonly slugs = computed(() => [this.slug(), this.andere()]);

  /** Keine der beiden Arten gibt es: dann führt der Weg zurück in den Katalog. */
  protected readonly unknown = computed(() => this.slugs().some((slug) => this.state.unknown().has(slug)));

  protected readonly viewport = computed<Viewport | null>(() => {
    const known = this.state.profile();
    const species = this.slugs().map((slug) => known.get(slug));
    if (species.some((art) => art === undefined)) return null;
    const found = species.filter((art) => art !== undefined);
    const names = found.map((art) => art.name);
    return {
      names,
      label: this.i18n.translate('vergleich.tabelle', { arten: names.join(', ') }),
      rows: comparisonRows(this.i18n, found),
    };
  });

  constructor() {
    effect(() => {
      for (const slug of this.slugs()) this.state.loadProfile(slug);
    });
  }

  protected back(): void {
    void this.router.navigate(['/arten', this.slug()]);
  }
}
