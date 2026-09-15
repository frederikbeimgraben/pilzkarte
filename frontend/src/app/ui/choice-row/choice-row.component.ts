import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Die Zeile steht in einer Liste oder als Kasten mit eigenem Rand. */
export type ChoiceRowVariant = 'list' | 'boxed';

/** Wert im Filter: Kästchen, Name und die Zahl der treffenden Arten. */
@Component({
  selector: 'app-choice-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './choice-row.component.html',
  styleUrl: './choice-row.component.scss',
  host: { '[class.choice-row--boxed]': "variant() === 'boxed'" },
})
export class ChoiceRowComponent {
  readonly label = input.required<string>();
  readonly count = input<string>();
  readonly checked = input(false);
  readonly variant = input<ChoiceRowVariant>('list');

  readonly toggled = output<boolean>();

  /** Im Kasten misst das Kästchen weniger, der Haken darin ebenso. */
  protected readonly tick = computed(() => (this.variant() === 'boxed' ? 12 : 15));

  protected onChange(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}
