import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Ein Stück der Bahn: wo es anfängt und wie breit es ist, in Prozent. */
interface Body {
  left: number;
  width: number;
}

const MONTHS = 12;

/**
 * Das Jahr als Bahn, mit vier Marken.
 *
 * Zusammenhängende Monate sind ein Körper. Läuft eine Zeit über den
 * Jahreswechsel, zerfällt sie in zwei Körper statt in eine Ausnahme: der
 * Austernseitling steht dann links und rechts, nicht quer über die ganze Bahn.
 *
 * Die blasse Bahn ist der Zeitraum der Quelle, die kräftige die Hauptzeit aus
 * der Saisonkurve. Ohne Kurve steht die genannte Zeit allein und kräftig — es
 * gibt dann nichts, wovon sie sich abheben müsste.
 */
@Component({
  selector: 'app-year-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './year-band.component.html',
  styleUrl: './year-band.component.scss',
})
export class YearBandComponent {
  readonly fromMonth = input.required<number>();
  readonly toMonth = input.required<number>();
  readonly peakFromMonth = input<number | null>(null);
  readonly peakToMonth = input<number | null>(null);
  readonly months = input.required<readonly string[]>();
  readonly label = input.required<string>();

  protected readonly stated = computed(() => bodies(this.fromMonth(), this.toMonth()));

  protected readonly observed = computed(() => {
    const from = this.peakFromMonth();
    const to = this.peakToMonth();
    return from === null || to === null ? [] : bodies(from, to);
  });

  /** Ohne beobachtete Zeit trägt die genannte die volle Farbe. */
  protected readonly muted = computed(() => this.observed().length > 0);
}

/** Die Körper einer Monatsspanne. Über den Jahreswechsel werden es zwei. */
export function bodies(fromMonth: number, toMonth: number): Body[] {
  const share = 100 / MONTHS;
  if (fromMonth <= toMonth) {
    return [{ left: (fromMonth - 1) * share, width: (toMonth - fromMonth + 1) * share }];
  }
  return [
    { left: 0, width: toMonth * share },
    { left: (fromMonth - 1) * share, width: (MONTHS - fromMonth + 1) * share },
  ];
}
