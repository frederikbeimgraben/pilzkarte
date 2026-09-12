import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/**
 * Welche Strecke gemessen wurde. Das Zeichen sagt es, nicht der Feldname:
 * es zeigt den Pilzteil selbst mit einer Maßlinie daneben. Ein reiner Pfeil
 * sagte nur, dass gemessen wird, nicht was.
 */
export type Extent = 'hutbreite' | 'stielhoehe' | 'stieldicke' | 'sporenlaenge';

const SYMBOL: Record<Extent, IconName> = {
  hutbreite: 'hutbreite',
  stielhoehe: 'stielhoehe',
  stieldicke: 'stieldicke',
  sporenlaenge: 'sporenlaenge',
};

/** Der Gedankenstrich der Spanne steht mit Leerzeichen, wie im Satz. */
const DASH = ' – ';

/**
 * Eine Messung: Zeichen für die Strecke, dahinter Zahl und Einheit.
 *
 * Kein Balken. Eine gemeinsame Skala zwischen einem Hut in Zentimetern und
 * einer Spore in Mikrometern gibt es nicht, und ein Balken täuschte sie vor.
 * Das Zeichen sagt stattdessen, was gemessen wurde: Durchmesser, Höhe, Dicke.
 */
@Component({
  selector: 'app-measurement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './measurement.component.html',
  styleUrl: './measurement.component.scss',
})
export class MeasurementComponent {
  readonly extent = input.required<Extent>();
  readonly from = input.required<number>();
  /** Ohne oberen Wert steht dort nur eine Zahl, kein Strich. */
  readonly to = input<number | null>(null);
  readonly unit = input.required<string>();
  /** Beschreibung des Zeichens für Hilfsmittel. */
  readonly label = input.required<string>();

  protected readonly icon = computed(() => SYMBOL[this.extent()]);

  protected readonly text = computed(() => {
    const to = this.to();
    const from = format(this.from());
    return to === null || to === this.from() ? from : `${from}${DASH}${format(to)}`;
  });
}

/** Deutsche Schreibweise: Komma statt Punkt, keine Nullen hinter dem Komma. */
function format(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}
