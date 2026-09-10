import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Welche Griffe die Spur trägt. `unten` und `oben` sind die Bedingungen „über“
 * und „unter“: eine Grenze steht am Ende der Skala und lässt sich nicht ziehen.
 */
export type Handles = 'beide' | 'unten' | 'oben';

/**
 * Ein oder zwei Griffe über einer Spur. Jeder Griff ist ein eigener
 * Schieberegler des Browsers, damit Tastatur und Hilfsmittel ohne eigenes
 * Zutun stimmen.
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
  readonly step = input(1);
  readonly von = input.required<number>();
  readonly bis = input.required<number>();
  readonly handles = input<Handles>('beide');

  readonly fromChange = output<number>();
  readonly toChange = output<number>();

  protected readonly fromShare = computed(() => this.share(this.von()));
  protected readonly toShare = computed(() => this.share(this.bis()));
  protected readonly showsFrom = computed(() => this.handles() !== 'oben');
  protected readonly showsTo = computed(() => this.handles() !== 'unten');

  protected text(schluessel: 'schieber.untereGrenze' | 'schieber.obereGrenze'): string {
    return this.i18n.translate(schluessel);
  }

  /** Die Griffe dürfen sich nicht überholen, sonst kehrt sich die Bedingung um. */
  protected beiVon(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.fromChange.emit(Math.min(value, this.bis()));
  }

  protected beiBis(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.toChange.emit(Math.max(value, this.von()));
  }

  private share(value: number): string {
    const span = this.max() - this.min() || 1;
    return `${((value - this.min()) / span) * 100}%`;
  }
}
