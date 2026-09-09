import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/**
 * Der Kopf des Blatts: Art, Woche, Pfeilgruppe und darunter die Zeitleiste.
 * Die Zeitleiste wird projiziert, damit der Kopf nichts über die Wochen wissen
 * muss.
 */
@Component({
  selector: 'app-sheet-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './sheet-head.component.html',
  styleUrl: './sheet-head.component.scss',
})
export class SheetHeadComponent {
  private readonly i18n = inject(I18nService);

  readonly titel = input.required<string>();
  /** Die Art führt zur Artenliste, „Kombination“ und „Faktor“ nicht. */
  readonly titelAlsLink = input(false);
  readonly woche = input<string>();
  /** Steht rechts neben der Woche, in Gefahrfarbe, etwa „· Prognose“. */
  readonly hinweis = input<string>();
  readonly pfeile = input(true);

  readonly titelKlick = output();
  readonly zurueck = output();
  readonly abspielen = output();
  readonly vor = output();

  protected text(schluessel: 'zeitleiste.zurueck' | 'zeitleiste.abspielen' | 'zeitleiste.vor'): string {
    return this.i18n.translate(schluessel);
  }
}
