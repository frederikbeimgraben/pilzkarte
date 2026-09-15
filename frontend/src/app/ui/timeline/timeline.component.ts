import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import { WeekButtonComponent } from './week-button.component';

/** Eine Woche des Manifests. `anteil` ist `mean` geteilt durch den Höchstwert. */
export interface TimelineWeek {
  year: number;
  week: number;
  share: number;
  forecast: boolean;
}

interface ShownWeek extends TimelineWeek {
  yearMark: boolean;
  key: string;
}

/** Die Wochen einer Art nebeneinander, ein Tabulatorziel mit Pfeiltasten. */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekButtonComponent],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent {
  private readonly buttons = viewChildren(WeekButtonComponent);
  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');

  readonly weeks = input.required<readonly TimelineWeek[]>();
  readonly active = input<{ year: number; week: number } | null>(null);
  readonly label = input.required<string>();
  /** Gedämpft und ohne Wahl, für eine feste Ebene ohne Woche. */
  readonly dimmed = input(false);
  /** Ohne Manifest steht die Leiste als Reihe von Platzhaltern. */
  readonly loading = input(false);

  /** Acht Tasten, so viele wie das Manifest im Regelfall trägt. */
  protected readonly placeholders = [0, 1, 2, 3, 4, 5, 6, 7];

  readonly chosen = output<TimelineWeek>();

  protected readonly shown = computed<ShownWeek[]>(() =>
    this.weeks().map((week, i, all) => ({
      ...week,
      yearMark: i > 0 && all[i - 1].year !== week.year,
      key: `${week.year}-${week.week}`,
    })),
  );

  protected readonly activeIndex = computed(() => {
    const active = this.active();
    if (!active) return 0;
    const index = this.weeks().findIndex((w) => w.year === active.year && w.week === active.week);
    return index < 0 ? 0 : index;
  });

  constructor() {
    // Die gewählte Woche muss sichtbar sein, auch wenn sie über einen Deep Link
    // oder die Pfeile im Kopf gesetzt wurde und weit außerhalb liegt.
    effect(() => {
      this.bringIntoView(this.activeIndex(), false);
    });
  }

  protected isActive(week: TimelineWeek): boolean {
    const active = this.active();
    return active !== null && active.year === week.year && active.week === week.week;
  }

  protected onKey(event: KeyboardEvent): void {
    const weeks = this.weeks();
    if (this.dimmed() || weeks.length === 0) return;
    const target = this.targetIndex(event.key, weeks.length);
    if (target === null) return;
    event.preventDefault();
    this.chosen.emit(weeks[target]);
    this.bringIntoView(target, true);
  }

  /** Schiebt die Woche in die Mitte. `scrollTo` bewegt nur die Leiste, nicht die Seite. */
  private bringIntoView(index: number, withFocus: boolean): void {
    const button = (this.buttons()[index] as WeekButtonComponent | undefined)?.element();
    const bar = this.bar().nativeElement;
    if (!button) return;
    // Die Mitte fällt auf einen ganzen Punkt, sonst steht die Leiste auf halber Linie.
    const center = Math.round(button.offsetLeft - (bar.clientWidth - button.offsetWidth) / 2);
    bar.scrollTo({ left: Math.max(center, 0), behavior: 'smooth' });
    if (withFocus) button.focus();
  }

  private targetIndex(key: string, count: number): number | null {
    const current = this.activeIndex();
    if (key === 'ArrowRight') return Math.min(count - 1, current + 1);
    if (key === 'ArrowLeft') return Math.max(0, current - 1);
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    return null;
  }
}
