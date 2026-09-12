import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerGroups, type Layer } from '../../core/tiles/layers';
import { SvgIconComponent, type IconName } from '../../ui/svg-icon/svg-icon.component';

/**
 * Das Zeichen je Ebene. Wo mehrere Ebenen dasselbe messen, tragen sie dasselbe
 * Zeichen: die Buche unterscheidet sich von der Fichte im Namen, nicht im Bild.
 */
const GLYPHS: Record<string, IconName> = {
  regen: 'wolke',
  regen_2w: 'wolke',
  regen_4w: 'kalender',
  regen_8w: 'kalender',
  regen_anomalie: 'ausschlag',
  temperatur: 'thermometer',
  temperatur_min: 'frost',
  wald: 'wald',
  fichte: 'nadelbaum',
  kiefer: 'nadelbaum',
  nadelholz: 'nadelbaum',
  buche: 'blatt',
  eiche: 'blatt',
  birke: 'blatt',
  hoehe: 'hoehe',
  hangneigung: 'hang',
  nordexposition: 'kompass',
  relief: 'relief',
  gelaendeposition: 'kuppe',
  boden_ph: 'kolben',
  boden_sand: 'koerner',
  boden_kohlenstoff: 'bodenschichten',
};

/** Eine Ebene mit ihrem Zeichen. */
interface LayerCard {
  layer: Layer;
  glyph: IconName;
}

interface Group {
  title: 'ebene.jeWoche' | 'ebene.fest';
  cards: readonly LayerCard[];
}

/**
 * Die Eingabe-Ebenen in zwei Gruppen: was der Woche folgt und was für alle
 * Wochen gilt. Jede Ebene ist eine Karte mit eigenem Zeichen; die Einheit
 * steht umrandet daneben, damit die Wahl schon sagt, worin die Ebene misst.
 */
@Component({
  selector: 'app-layer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
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
    const groups: Group[] = [
      { title: 'ebene.jeWoche', cards: perWeek.map((layer) => this.card(layer)) },
      { title: 'ebene.fest', cards: fixed.map((layer) => this.card(layer)) },
    ];
    return groups.filter((group) => group.cards.length > 0);
  });

  /** Eine unbekannte Ebene bekommt das allgemeine Zeichen der Ebenen. */
  private card(layer: Layer): LayerCard {
    return { layer, glyph: GLYPHS[layer.id] ?? 'ebenen' };
  }
}
