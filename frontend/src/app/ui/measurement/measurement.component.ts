import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';

/** Welche Strecke die Zeile nennt. Das Wort trägt, kein Zeichen mehr. */
export type Extent = 'width' | 'height' | 'length' | 'thickness';

const EXTENT_KEY: Record<Extent, TranslationKey> = {
  width: 'enum.dimension.width',
  height: 'enum.dimension.height',
  length: 'enum.dimension.length',
  thickness: 'enum.dimension.thickness',
};

/** Der Gedankenstrich der Spanne steht mit Leerzeichen, wie im Satz. */
const DASH = ' – ';

/** Eine Spanne. Eine Seite kann fehlen, etwa bei der seltenen Ausnahme. */
export interface Span {
  readonly from: number | null;
  readonly to: number | null;
}

/** Eine Zeile Maß: das Wort der Strecke, der Wert, darunter die seltene Ausnahme. */
@Component({
  selector: 'app-measurement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './measurement.component.html',
  styleUrl: './measurement.component.scss',
  host: { '[class.measure--rare]': 'rare() !== null' },
})
export class MeasurementComponent {
  private readonly i18n = inject(I18nService);

  readonly extent = input.required<Extent>();
  readonly spans = input.required<readonly Span[]>();
  readonly unit = input.required<string>();

  protected readonly extentKey = computed(() => EXTENT_KEY[this.extent()]);
  protected readonly text = computed(() => spanText(this.spans().at(0)));
  protected readonly rare = computed(() => this.rareText());

  private rareText(): string | null {
    const span = this.spans().at(1);
    if (!span) return null;
    const unit = this.unit();
    if (span.to !== null)
      return this.i18n.translate('art.mass.seltenBis', { wert: format(span.to), einheit: unit });
    if (span.from !== null) {
      return this.i18n.translate('art.mass.seltenVon', { wert: format(span.from), einheit: unit });
    }
    return null;
  }
}

/** Eine Spanne als Text. Fehlt eine Seite oder sind beide gleich, bleibt eine Zahl. */
export function spanText(span: Span | undefined): string {
  if (!span) return '';
  if (span.from === null) return span.to === null ? '' : format(span.to);
  if (span.to === null || span.to === span.from) return format(span.from);
  return `${format(span.from)}${DASH}${format(span.to)}`;
}

/** Deutsche Schreibweise: Komma statt Punkt, keine Nullen hinter dem Komma. */
function format(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}
