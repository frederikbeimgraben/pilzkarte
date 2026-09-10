import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Layer } from '../../core/tiles/layers';
import type { CombinationRule } from '../../map/value-colors';
import {
  ActionBarComponent,
  FactorRowComponent,
  NoteComponent,
  SegmentedComponent,
  type SegmentOption,
} from '../../ui';
import { conditionText, type Faktor } from './factors';

/** Ein Faktor, wie ihn die Zeile braucht: mit aufgelöster Quelle. */
interface Row {
  factor: Faktor;
  name: string;
  subline: string;
  condition: string;
}

/**
 * Die Darstellung „Kombination“: eine Regel, eine Liste von Faktoren und die
 * Aktionen darunter. Sie hängt an keiner Art.
 */
@Component({
  selector: 'app-combination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, FactorRowComponent, NoteComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './combination.component.html',
  styleUrl: './combination.component.scss',
})
export class KombinationComponent {
  private readonly i18n = inject(I18nService);

  readonly factors = input.required<readonly Faktor[]>();
  /** Die Quellen der Faktoren, nach Kennung. Was fehlt, wird nicht gezeigt. */
  readonly sources = input.required<ReadonlyMap<string, Layer>>();
  readonly rule = input.required<CombinationRule>();
  /** Die Woche, auf die sich die Wochenfaktoren beziehen. */
  readonly weekText = input<string>();

  readonly ruleChange = output<CombinationRule>();
  readonly activeChange = output<{ factor: Faktor; active: boolean }>();
  readonly openFactor = output<Faktor>();
  readonly add = output();

  protected readonly rules = computed<SegmentOption[]>(() =>
    (['schnitt', 'abgestuft'] as const).map((value) => ({
      value,
      label: this.i18n.translate(`kombination.${value}`),
    })),
  );

  protected readonly rows = computed<Row[]>(() => {
    const sources = this.sources();
    const locale = this.i18n.locale();
    const bis = this.i18n.translate('faktor.bis');
    return this.factors().flatMap((factor) => {
      const layer = sources.get(factor.source);
      if (!layer) return [];
      return [
        {
          factor,
          name: layer.label,
          subline: layer.fixed
            ? this.i18n.translate('faktor.konstant')
            : (this.weekText() ?? this.i18n.translate('faktor.konstant')),
          condition: conditionText(factor, layer, locale, bis),
        },
      ];
    });
  });

  protected readonly hint = computed(() =>
    this.i18n.translate(
      this.rule() === 'schnitt' ? 'kombination.hinweisSchnitt' : 'kombination.hinweisAbgestuft',
      { woche: this.weekText() ?? '' },
    ),
  );

  protected setRule(value: string): void {
    if (value === 'schnitt' || value === 'abgestuft') this.ruleChange.emit(value);
  }
}
