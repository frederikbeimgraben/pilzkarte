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
 * Das Malzeichen der Bestimmungsbücher: U+00D7, nicht der Buchstabe x.
 */
const TIMES = ' \u00d7 ';

/** Eine Strecke: von, bis. Der obere Wert fehlt, wo die Quelle nur einen nennt. */
export interface Span {
  von: number;
  bis: number | null;
}

/**
 * Die Maße eines Körperteils: Zeichen, dann Länge mal Breite, dann die Einheit.
 *
 * Eine Zeile je Körperteil, nicht je Strecke. „Sporen Länge“ und „Sporen
 * Breite“ standen einmal als zwei gleichrangige Zeilen neben „Hut“ und ließen
 * drei Merkmale erscheinen, wo zwei sind. So schreiben es auch die
 * Bestimmungsbücher und die Quellseiten: 13 – 18 × 5 – 6 µm.
 *
 * Kein Balken. Eine gemeinsame Skala zwischen einem Hut in Zentimetern und
 * einer Spore in Mikrometern gibt es nicht, und ein Balken täuschte sie vor.
 */
@Component({
  selector: 'app-measurement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './measurement.component.html',
  styleUrl: './measurement.component.scss',
})
export class MeasurementComponent {
  /** Das Zeichen: das des Körperteils, oder das der Strecke, wenn nur eine steht. */
  readonly extent = input.required<Extent>();
  /** Länge oder Höhe zuerst, dann Breite oder Dicke. */
  readonly spans = input.required<readonly Span[]>();
  readonly unit = input.required<string>();
  /** Beschreibung des Zeichens für Hilfsmittel. */
  readonly label = input.required<string>();

  protected readonly icon = computed(() => SYMBOL[this.extent()]);

  protected readonly text = computed(() => this.spans().map(range).join(TIMES));
}

/** Eine Strecke als Text. Ohne oberen Wert steht dort nur eine Zahl. */
function range(span: Span): string {
  const from = format(span.von);
  return span.bis === null || span.bis === span.von ? from : `${from}${DASH}${format(span.bis)}`;
}

/** Deutsche Schreibweise: Komma statt Punkt, keine Nullen hinter dem Komma. */
function format(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}
