import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { layerIcon } from '../../core/tiles/layer-groups';
import { layerGroups, unitOf, type Layer } from '../../core/tiles/layers';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { layerTitle } from './layer-name';
import { DETENT_SIZES } from './map-surface';

/** Die Quelle eines neuen Faktors: Ebenen und Arten. Belegtes fehlt. */
@Component({
  selector: 'app-factor-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OptionSheetComponent],
  templateUrl: './factor-picker.component.html',
})
export class FactorPickerComponent {
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  readonly layers = input.required<readonly Layer[]>();
  readonly species = input<readonly Layer[]>([]);
  /** Die Quellen, die schon einen Faktor haben. Sie stehen nicht zur Wahl. */
  readonly assigned = input<ReadonlySet<string>>(new Set());

  readonly chosen = output<Layer>();
  readonly closed = output();

  protected readonly title = computed(() => this.i18n.translate('map.factor.choose'));
  /** Dieselbe Höhe wie jedes andere Blatt über der Karte. */
  protected readonly detents = DETENT_SIZES;

  private readonly free = computed<readonly Layer[]>(() => {
    const { perWeek, fixed } = layerGroups(this.layers());
    return [...perWeek, ...fixed, ...this.species()].filter((layer) => !this.assigned().has(layer.id));
  });

  protected readonly options = computed<readonly OptionSheetOption[]>(() =>
    this.free().map((layer) => ({
      id: layer.id,
      title: layerTitle(layer, this.i18n),
      // Eine Art trägt das Zeichen der Arten, eine Ebene das ihrer Gruppe.
      icon: layerIcon(layer.id) ?? 'species',
      value: unitOf(layer),
    })),
  );

  protected pick(id: string): void {
    const layer = this.free().find((entry) => entry.id === id);
    if (layer) this.chosen.emit(layer);
  }
}
