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
  readonly beschriftung = input.required<string>();
  readonly wert = input.required<number>();
  readonly min = input(0);
  readonly max = input(100);
  readonly schritt = input(1);
  /** Der Wert in Worten, etwa „70 %“. Er steht rechts neben der Beschriftung. */
  readonly wertText = input<string>();

  readonly wertChange = output<number>();

  protected readonly anteil = computed(() => {
    const spanne = this.max() - this.min() || 1;
    return `${((this.wert() - this.min()) / spanne) * 100}%`;
  });

  protected beiEingabe(ereignis: Event): void {
    this.wertChange.emit(Number((ereignis.target as HTMLInputElement).value));
  }
}
