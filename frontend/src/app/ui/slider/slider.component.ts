import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Ein Griff über einer Spur, mit Beschriftung und Wert daneben. Der Regler ist
 * der des Browsers, damit Tastatur und Hilfsmittel ohne eigenes Zutun stimmen.
 */
@Component({
  selector: 'app-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.scss',
})
export class SliderComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  /** Der Wert in Worten, etwa „70 %“. Er steht rechts neben der Beschriftung. */
  readonly valueText = input<string>();

  readonly valueChange = output<number>();

  protected readonly share = computed(() => {
    const span = this.max() - this.min() || 1;
    return `${((this.value() - this.min()) / span) * 100}%`;
  });

  protected onInput(event: Event): void {
    this.valueChange.emit(Number((event.target as HTMLInputElement).value));
  }
}
