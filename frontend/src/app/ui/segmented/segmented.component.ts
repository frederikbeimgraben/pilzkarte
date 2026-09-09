import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Eine Wahl im Segmented. */
export interface SegmentOption {
  wert: string;
  label: string;
}

/**
 * Zwei bis vier Wahlmöglichkeiten nebeneinander, Rolle `tablist`. Pfeiltasten
 * wechseln die Wahl, wie es die Tastaturregeln für Reiter verlangen.
 */
@Component({
  selector: 'app-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segmented.component.html',
  styleUrl: './segmented.component.scss',
})
export class SegmentedComponent {
  readonly optionen = input.required<readonly SegmentOption[]>();
  readonly wert = input.required<string>();
  readonly beschriftung = input.required<string>();

  readonly wertChange = output<string>();

  protected beiTaste(ereignis: KeyboardEvent, index: number): void {
    const schritt = ereignis.key === 'ArrowRight' ? 1 : ereignis.key === 'ArrowLeft' ? -1 : 0;
    if (schritt === 0) return;
    const optionen = this.optionen();
    const ziel = (index + schritt + optionen.length) % optionen.length;
    ereignis.preventDefault();
    this.wertChange.emit(optionen[ziel].wert);
  }
}
