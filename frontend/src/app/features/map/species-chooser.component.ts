import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { SpeciesBrief, SpeciesCatalogue } from '../../core/api/models';
import { FORECAST_SLUGS, type ForecastSlug } from '../../core/tiles/tile-paths';
import { ActionBarComponent, ListRowComponent, SeasonCurveComponent, SheetComponent } from '../../ui';

/** Eine Art, wie die Wahl sie zeigt. */
interface Row {
  art: SpeciesBrief;
  slug: ForecastSlug;
  curve: readonly number[];
  current: readonly number[];
  label: string;
}

/**
 * Die Wahl der Art für die Karte, aus dem Blattkopf heraus.
 *
 * Nur Arten, deren Karte auch gezeichnet werden kann: für alles andere gäbe es
 * nichts zu zeigen, und eine Zeile ohne Wirkung ist schlimmer als keine Zeile.
 * Wer den Katalog sucht, findet ihn in der letzten Zeile.
 */
@Component({
  selector: 'app-species-chooser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormsModule,
    InputComponent,
    ListRowComponent,
    SeasonCurveComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './species-chooser.component.html',
  styleUrl: './species-chooser.component.scss',
})
export class SpeciesChooserComponent {
  private readonly i18n = inject(I18nService);

  readonly catalogue = input<SpeciesCatalogue | null>(null);
  /** Der Kartenschlüssel der Art, die gerade auf der Karte liegt. */
  readonly selected = input<string | null>(null);

  readonly chosen = output<ForecastSlug>();
  readonly zumKatalog = output();
  readonly closed = output();

  protected readonly search = signal('');

  protected readonly begehungen = computed<readonly number[]>(
    () => this.catalogue()?.begehungenJeWocheAlleJahre ?? [],
  );
  protected readonly visitsCurrentYear = computed<readonly number[]>(
    () => this.catalogue()?.begehungenJeWocheLaufendesJahr ?? [],
  );

  protected readonly rows = computed<Row[]>(() => {
    const search = this.search().trim().toLocaleLowerCase();
    return (this.catalogue()?.arten ?? [])
      .flatMap((art) => {
        const slug = FORECAST_SLUGS.find((known) => known === art.kartenSlug);
        return slug ? [{ art, slug }] : [];
      })
      .filter(
        ({ art }) =>
          search === '' ||
          art.name.toLocaleLowerCase().includes(search) ||
          art.lateinisch.toLocaleLowerCase().includes(search),
      )
      .map(({ art, slug }) => ({
        art,
        slug,
        curve: art.saison?.alleJahre ?? [],
        current: art.saison?.laufendesJahr ?? [],
        label: this.i18n.translate('saison.beschriftung'),
      }));
  });
}
