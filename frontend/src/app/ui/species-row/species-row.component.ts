import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Eine Zeile der Artenliste: Name und lateinischer Name links, die Saisonkurve
 * rechts, die Tags darunter. Kurve und Tags kommen als Inhalt, damit die Zeile
 * weder Kurvendaten noch Badge-Varianten kennen muss.
 *
 * Die Marke „aktiv“ gehört der Zeile selbst. Ein Badge des Kits stünde auf der
 * aktiven Zeile Fläche auf Fläche in derselben Farbe und wäre unsichtbar.
 */
@Component({
  selector: 'app-species-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './species-row.component.html',
  styleUrl: './species-row.component.scss',
})
export class SpeciesRowComponent {
  private readonly i18n = inject(I18nService);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  readonly name = input.required<string>();
  readonly latin = input.required<string>();
  readonly active = input(false);

  readonly chosen = output();

  /** Setzt den Fokus auf die Zeile. Die Liste wandert damit per Pfeiltaste. */
  focus(): void {
    this.button().nativeElement.focus();
  }

  protected activeText(): string {
    return this.i18n.translate('arten.aktiv');
  }
}
