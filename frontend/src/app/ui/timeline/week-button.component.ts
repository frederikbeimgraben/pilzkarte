import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Eine Woche in der Zeitleiste. Der Balken zeigt das Mittel der Vorhersage
 * über Deutschland, relativ zum Höchstwert der Art; eine Prognosewoche hat
 * einen gestrichelten Rand.
 */
@Component({
  selector: 'app-week-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './week-button.component.html',
  styleUrl: './week-button.component.scss',
})
export class WeekButtonComponent {
  private readonly i18n = inject(I18nService);
  private readonly knopf = viewChild.required<ElementRef<HTMLButtonElement>>('knopf');

  readonly jahr = input.required<number>();
  readonly woche = input.required<number>();
  /** Balkenhöhe, 0 bis 1. */
  readonly anteil = input(0);
  readonly prognose = input(false);
  readonly aktiv = input(false);
  /** Die erste Woche eines Jahres trägt die Jahreszahl über sich. */
  readonly jahresmarke = input(false);
  /** Nur eine Woche der Leiste liegt im Tabulator-Weg; die Pfeile führen weiter. */
  readonly imTabWeg = input(true);

  readonly auswahl = output();

  protected readonly balken = computed(() => `${Math.round(Math.min(Math.max(this.anteil(), 0), 1) * 100)}%`);

  /** Holt die Woche in den Blick und, wenn gewünscht, in den Fokus. */
  zeige(mitFokus: boolean): void {
    const element = this.knopf().nativeElement;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (mitFokus) element.focus();
  }

  protected beschriftung(): string {
    const text = this.i18n.translate('zeitleiste.woche', { woche: this.woche(), jahr: this.jahr() });
    return this.prognose() ? `${text} · ${this.i18n.translate('zeitleiste.prognose')}` : text;
  }
}
