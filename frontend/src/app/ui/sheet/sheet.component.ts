import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Die drei Rasten des Blatts, von unten nach oben. */
export type Raste = 0 | 1 | 2;

/**
 * Anteil der Höhe des Elternelements je Raste. Aus den Artboards `Main`
 * (halb), `KarteEingeklappt` (Kopf) und `Zone` (voll).
 */
export const RASTEN_STANDARD: readonly [number, number, number] = [0.2, 0.4, 0.9];

/**
 * Das Blatt über der Karte. Es liegt auf einer der drei Rasten; ein Tipp auf
 * den Griff geht zur nächsten. Die Geste kommt in A2, die Rasten und der
 * Fokusfang stehen schon.
 */
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './sheet.component.html',
  styleUrl: './sheet.component.scss',
})
export class SheetComponent {
  private readonly wirt = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);

  readonly beschriftung = input.required<string>();
  readonly raste = input<Raste>(1);
  readonly rasten = input<readonly [number, number, number]>(RASTEN_STANDARD);
  /** Ein Blatt, das die Karte sperrt (Melden, Anmelden), fängt den Fokus. */
  readonly modal = input(false);
  /** Der Griff-Tipp steht unter dem Griff, solange die Geste fehlt. */
  readonly griffTipp = input(false);

  readonly rasteChange = output<Raste>();

  protected readonly hoehe = computed(() => `${this.rasten()[this.raste()] * 100}%`);

  protected griffText(): string {
    return this.i18n.translate('sheet.griff');
  }

  protected naechsteRaste(): void {
    this.rasteChange.emit(((this.raste() + 1) % 3) as Raste);
  }

  /** Im modalen Blatt bleibt der Tabulator im Blatt. */
  protected beiTaste(ereignis: KeyboardEvent): void {
    if (!this.modal() || ereignis.key !== 'Tab') return;
    const ziele = this.fokussierbare();
    if (ziele.length === 0) return;
    const erstes = ziele[0];
    const letztes = ziele[ziele.length - 1];
    const aktiv = document.activeElement;
    if (ereignis.shiftKey && aktiv === erstes) {
      letztes.focus();
      ereignis.preventDefault();
    } else if (!ereignis.shiftKey && aktiv === letztes) {
      erstes.focus();
      ereignis.preventDefault();
    }
  }

  private fokussierbare(): HTMLElement[] {
    const auswahl =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(this.wirt.nativeElement.querySelectorAll<HTMLElement>(auswahl));
  }
}
