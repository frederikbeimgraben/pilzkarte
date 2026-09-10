import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerGroups, type Layer } from '../../core/tiles/layers';
import { ActionBarComponent, ListRowComponent, SheetComponent } from '../../ui';

type GroupTitle = 'ebene.jeWoche' | 'ebene.fest' | 'faktor.arten';

interface Group {
  titel: GroupTitle;
  layers: readonly Layer[];
}

/**
 * Die Wahl einer Quelle für einen neuen Faktor: die Eingabe-Ebenen und die
 * Arten mit Vorhersage. Was schon in der Liste steht, ist gesperrt; zweimal
 * dieselbe Quelle zu prüfen hilft niemandem.
 */
@Component({
  selector: 'app-factor-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, ListRowComponent, SheetComponent, TranslatePipe],
  templateUrl: './factor-picker.component.html',
  styleUrl: './factor-picker.component.scss',
})
export class FactorPickerComponent {
  private readonly i18n = inject(I18nService);

  readonly layers = input.required<readonly Layer[]>();
  readonly arten = input<readonly Layer[]>([]);
  /** Die Quellen, die schon einen Faktor haben. */
  readonly assigned = input<ReadonlySet<string>>(new Set());

  readonly chosen = output<Layer>();
  readonly closed = output();

  protected readonly groups = computed<Group[]>(() => {
    const { perWeek, fixed } = layerGroups(this.layers());
    return (
      [
        { titel: 'ebene.jeWoche', layers: perWeek },
        { titel: 'ebene.fest', layers: fixed },
        { titel: 'faktor.arten', layers: this.arten() },
      ] as const
    )
      .filter((gruppe) => gruppe.layers.length > 0)
      .map((gruppe) => ({ titel: gruppe.titel, layers: gruppe.layers }));
  });

  protected subline(layer: Layer): string | undefined {
    return this.assigned().has(layer.id) ? this.i18n.translate('faktor.schonDabei') : undefined;
  }
}
