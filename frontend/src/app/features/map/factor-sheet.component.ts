import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { shareMet, formatValue, type Layer, type Histogram } from '../../core/tiles/layers';
import {
  ActionBarComponent,
  HistogramComponent,
  KeyValueRowComponent,
  NoteComponent,
  RangeSliderComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  type Handles,
  type SegmentOption,
} from '../../ui';
import { conditionText, span, type Condition, type Faktor } from './factors';

/** Wie fein der Griff läuft: fein genug zum Zielen, grob genug zum Ablesen. */
export function stepSize(layer: Layer): number {
  const breite = layer.high - layer.low;
  if (breite > 50) return 1;
  if (breite > 5) return 0.1;
  return 0.01;
}

/** Welche Griffe eine Bedingung braucht. */
const HANDLES: Record<Condition, Handles> = { unter: 'oben', ueber: 'unten', zwischen: 'beide' };

/**
 * Der Screen `Faktor`: die Verteilung der Quelle über Deutschland, die
 * Bedingung darüber, und was sie von der Fläche übrig lässt. Die Änderung
 * bleibt hier, bis sie übernommen wird.
 */
@Component({
  selector: 'app-factor-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    HistogramComponent,
    KeyValueRowComponent,
    NoteComponent,
    RangeSliderComponent,
    SegmentedComponent,
    SheetComponent,
    SheetHeadComponent,
    TranslatePipe,
  ],
  templateUrl: './factor-sheet.component.html',
  styleUrl: './factor-sheet.component.scss',
})
export class FactorSheetComponent {
  private readonly i18n = inject(I18nService);

  readonly factor = input.required<Faktor>();
  readonly layer = input.required<Layer>();
  readonly histogramm = input<Histogram | null>(null);
  /** Der Zeitbezug für den Kopf: die Woche oder „zeitlich konstant“. */
  readonly timeScope = input<string>();

  readonly apply = output<Faktor>();
  readonly remove = output<Faktor>();
  readonly closed = output();

  /** Der Faktor in Arbeit. Ein neuer Faktor von außen setzt ihn zurück. */
  protected readonly draft = linkedSignal<Faktor, Faktor>({
    source: this.factor,
    computation: (factor) => factor,
  });

  protected readonly conditions = computed<SegmentOption[]>(() =>
    (['unter', 'ueber', 'zwischen'] as const).map((value) => ({
      value,
      label: this.i18n.translate(`faktor.${value}`),
    })),
  );

  protected readonly handles = computed<Handles>(() => HANDLES[this.draft().condition]);
  protected readonly step = computed(() => stepSize(this.layer()));
  protected readonly values = computed(() => span(this.draft(), this.layer()));

  protected readonly fromShare = computed(() => this.shareOnScale(this.values().von));
  protected readonly toShare = computed(() => this.shareOnScale(this.values().bis));

  protected readonly condition = computed(() =>
    conditionText(this.draft(), this.layer(), this.i18n.locale(), this.i18n.translate('faktor.bis')),
  );

  protected readonly scaleFrom = computed(() =>
    formatValue(this.layer().low, this.layer(), this.i18n.locale()),
  );

  protected readonly scaleTo = computed(() =>
    formatValue(this.layer().high, this.layer(), this.i18n.locale()),
  );

  protected readonly distributionText = computed(() =>
    this.i18n.translate('faktor.verteilung', { ebene: this.layer().label }),
  );

  /** Was die Bedingung von der Fläche Deutschlands übrig lässt. */
  protected readonly shareText = computed(() => {
    const distribution = this.histogramm();
    if (!distribution) return this.i18n.translate('faktor.ohneVerteilung');
    const values = this.values();
    const share = shareMet(distribution, values.von, values.bis);
    return this.i18n.translate('faktor.anteil', { anteil: Math.round(share * 100) });
  });

  protected setCondition(value: string): void {
    const condition = (['unter', 'ueber', 'zwischen'] as const).find((entry) => entry === value);
    if (!condition) return;
    // Die Spanne bleibt, wo sie war: der Wechsel der Form soll den Faktor
    // nicht auf einen anderen Ausschnitt der Skala werfen.
    const values = this.values();
    this.draft.set({ ...this.draft(), condition, von: values.von, bis: values.bis });
  }

  protected setFrom(value: number): void {
    this.draft.set({ ...this.draft(), von: Math.min(value, this.values().bis) });
  }

  protected setTo(value: number): void {
    this.draft.set({ ...this.draft(), bis: Math.max(value, this.values().von) });
  }

  private shareOnScale(value: number): number {
    const breite = this.layer().high - this.layer().low;
    return breite === 0 ? 0 : Math.min(Math.max((value - this.layer().low) / breite, 0), 1);
  }
}
