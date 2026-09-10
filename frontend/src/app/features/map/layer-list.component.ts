import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerGroups, type Layer } from '../../core/tiles/layers';
import { ListRowComponent } from '../../ui';

interface Group {
  titel: 'ebene.jeWoche' | 'ebene.fest';
  layers: readonly Layer[];
}

/**
 * Die Eingabe-Ebenen in zwei Gruppen: was der Woche folgt und was für alle
 * Wochen gilt. Die Einheit steht in der Zeile, damit die Wahl schon sagt,
 * worin die Ebene misst.
 */
@Component({
  selector: 'app-layer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, TranslatePipe],
  templateUrl: './layer-list.component.html',
  styleUrl: './layer-list.component.scss',
})
export class LayerListComponent {
  readonly layers = input.required<readonly Layer[]>();
  readonly selected = input<string | null>(null);
  readonly label = input.required<string>();

  readonly chosen = output<Layer>();

  protected readonly groups = computed<Group[]>(() => {
    const { perWeek, fixed } = layerGroups(this.layers());
    return [
      { titel: 'ebene.jeWoche', layers: perWeek },
      { titel: 'ebene.fest', layers: fixed },
    ].filter((gruppe): gruppe is Group => gruppe.layers.length > 0);
  });
}
