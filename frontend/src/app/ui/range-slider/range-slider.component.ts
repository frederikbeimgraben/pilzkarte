import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Zwei Griffe über einer Spur. Beide Griffe sind eigene Schieberegler des
 * Browsers, damit Tastatur und Hilfsmittel ohne eigenes Zutun stimmen.
 */
@Component({
  selector: 'app-range-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './range-slider.component.html',
  styleUrl: './range-slider.component.scss',
})
export class RangeSliderComponent {
  private readonly i18n = inject(I18nService);

  readonly min = input(0);
  readonly max = input(100);
  readonly schritt = input(1);
  readonly von = input.required<number>();
  readonly bis = input.required<number>();

  readonly vonChange = output<number>();
  readonly bisChange = output<number>();

  protected readonly vonAnteil = computed(() => this.anteil(this.von()));
  protected readonly bisAnteil = computed(() => this.anteil(this.bis()));

  protected text(schluessel: 'schieber.untereGrenze' | 'schieber.obereGrenze'): string {
    return this.i18n.translate(schluessel);
  }

  /** Die Griffe dürfen sich nicht überholen, sonst kehrt sich die Bedingung um. */
  protected beiVon(ereignis: Event): void {
    const wert = Number((ereignis.target as HTMLInputElement).value);
    this.vonChange.emit(Math.min(wert, this.bis()));
  }

  protected beiBis(ereignis: Event): void {
    const wert = Number((ereignis.target as HTMLInputElement).value);
    this.bisChange.emit(Math.max(wert, this.von()));
  }

  private anteil(wert: number): string {
    const spanne = this.max() - this.min() || 1;
    return `${((wert - this.min()) / spanne) * 100}%`;
  }
}
