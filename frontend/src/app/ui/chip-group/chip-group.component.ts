import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Ein Filter-Chip. */
export interface Chip {
  value: string;
  label: string;
}

/** So viel schiebt ein Knopf: fast eine Breite, ein Chip bleibt als Anker stehen. */
const STEP = 0.8;

/**
 * Die waagerechte Chip-Reihe über Listen. Genau ein Chip ist gewählt; ein
 * Tipp auf den gewählten Chip lässt ihn gewählt, damit die Liste nie ohne
 * Filter dasteht.
 *
 * Am Telefon wischt man die Reihe. Am Rechner gibt es dafür nichts: dort
 * stehen zwei Knöpfe an den Rändern, und ein Verlauf zeigt, dass es weitergeht.
 * Sie verschwinden, sobald in ihrer Richtung nichts mehr steht.
 */
@Component({
  selector: 'app-chip-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './chip-group.component.html',
  styleUrl: './chip-group.component.scss',
})
export class ChipGroupComponent {
  private readonly i18n = inject(I18nService);
  private readonly series = viewChild.required<ElementRef<HTMLElement>>('series');

  readonly chips = input.required<readonly Chip[]>();
  readonly value = input.required<string>();
  readonly label = input.required<string>();

  readonly valueChange = output<string>();

  protected readonly zurueckMoeglich = signal(false);
  protected readonly vorMoeglich = signal(false);

  constructor() {
    afterNextRender(() => {
      this.validate();
    });
  }

  /** Wird das Fenster schmaler, passt plötzlich weniger in die Reihe. */
  @HostListener('window:resize')
  protected onResize(): void {
    this.validate();
  }

  protected backText(): string {
    return this.i18n.translate('chips.zurueck');
  }

  protected vorText(): string {
    return this.i18n.translate('chips.vor');
  }

  protected schiebe(direction: 1 | -1): void {
    const series = this.series().nativeElement;
    series.scrollBy({ left: direction * series.clientWidth * STEP, behavior: 'smooth' });
  }

  /** Nach jedem Scrollen und beim Aufbau: was steht links, was rechts noch aus. */
  protected validate(): void {
    const series = this.series().nativeElement;
    const rest = series.scrollWidth - series.clientWidth - series.scrollLeft;
    this.zurueckMoeglich.set(series.scrollLeft > 1);
    this.vorMoeglich.set(rest > 1);
  }
}
