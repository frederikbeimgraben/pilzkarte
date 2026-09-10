import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { WeekButtonComponent } from './week-button.component';

/** Eine Woche des Manifests. `anteil` ist `mean` geteilt durch den Höchstwert. */
export interface TimelineWeek {
  jahr: number;
  woche: number;
  share: number;
  forecast: boolean;
}

interface ShownWeek extends TimelineWeek {
  yearMark: boolean;
  schluessel: string;
}

/**
 * Die Wochen einer Art nebeneinander. Die Jahresmarke wird abgeleitet, damit
 * der Aufrufer nur die Wochen des Manifests reichen muss. Die Leiste ist ein
 * einziges Tabulatorziel; die Pfeiltasten laufen darin weiter, wie bei einer
 * Werkzeugleiste.
 */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekButtonComponent],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent {
  private readonly buttons = viewChildren(WeekButtonComponent);

  readonly wochen = input.required<readonly TimelineWeek[]>();
  readonly active = input<{ jahr: number; woche: number } | null>(null);
  readonly label = input.required<string>();
  /**
   * Gedämpft und ohne Wahl. Eine feste Ebene gilt für alle Wochen; die Leiste
   * bleibt sichtbar, damit die Zeit greifbar bleibt, nimmt aber nichts an.
   */
  readonly dimmed = input(false);

  readonly chosen = output<TimelineWeek>();

  protected readonly shown = computed<ShownWeek[]>(() =>
    this.wochen().map((woche, i, alle) => ({
      ...woche,
      yearMark: i > 0 && alle[i - 1].jahr !== woche.jahr,
      schluessel: `${woche.jahr}-${woche.woche}`,
    })),
  );

  protected readonly activeIndex = computed(() => {
    const active = this.active();
    if (!active) return 0;
    const index = this.wochen().findIndex((w) => w.jahr === active.jahr && w.woche === active.woche);
    return index < 0 ? 0 : index;
  });

  constructor() {
    // Die gewählte Woche muss sichtbar sein, auch wenn sie über einen Deep Link
    // oder die Pfeile im Kopf gesetzt wurde und weit außerhalb liegt.
    effect(() => {
      const button = this.buttons()[this.activeIndex()] as WeekButtonComponent | undefined;
      button?.show(false);
    });
  }

  protected isActive(woche: TimelineWeek): boolean {
    const active = this.active();
    return active !== null && active.jahr === woche.jahr && active.woche === woche.woche;
  }

  protected onKey(event: KeyboardEvent): void {
    const wochen = this.wochen();
    if (this.dimmed() || wochen.length === 0) return;
    const target = this.targetIndex(event.key, wochen.length);
    if (target === null) return;
    event.preventDefault();
    this.chosen.emit(wochen[target]);
    (this.buttons()[target] as WeekButtonComponent | undefined)?.show(true);
  }

  private targetIndex(key: string, anzahl: number): number | null {
    const jetzt = this.activeIndex();
    if (key === 'ArrowRight') return Math.min(anzahl - 1, jetzt + 1);
    if (key === 'ArrowLeft') return Math.max(0, jetzt - 1);
    if (key === 'Home') return 0;
    if (key === 'End') return anzahl - 1;
    return null;
  }
}
