import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Die Piktogramme der Mockups. Strich auf 24er-Raster, Pfeile auf 12er. */
export type IconName =
  | 'karte'
  | 'arten'
  | 'funde'
  | 'mehr'
  | 'plus'
  | 'ort'
  | 'ebenen'
  | 'zurueck'
  | 'vor'
  | 'zu'
  | 'haken'
  | 'zone'
  | 'suche'
  | 'warnung'
  | 'info'
  | 'schloss'
  | 'leer'
  | 'links'
  | 'rechts'
  | 'abspielen'
  | 'pause'
  | 'wolke'
  | 'kalender'
  | 'ausschlag'
  | 'thermometer'
  | 'frost'
  | 'wald'
  | 'nadelbaum'
  | 'blatt'
  | 'hoehe'
  | 'hang'
  | 'kompass'
  | 'relief'
  | 'kuppe'
  | 'kolben'
  | 'koerner'
  | 'bodenschichten'
  | 'hutbreite'
  | 'stielhoehe'
  | 'stieldicke'
  | 'sporenlaenge'
  | 'wandelt'
  | 'dauer';

/** Die drei gefüllten Pfeile der Kopfzeile sitzen auf einem 12er-Raster. */
const FILLED: readonly IconName[] = ['links', 'rechts', 'abspielen', 'pause'];

/**
 * Ein Piktogramm aus `docs/mockups/bauen.py`. Ohne Beschriftung ist es
 * schmückend und für Hilfsmittel unsichtbar; mit Beschriftung trägt es die
 * Bedeutung selbst.
 */
@Component({
  selector: 'app-svg-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './svg-icon.component.html',
  styleUrl: './svg-icon.component.scss',
})
export class SvgIconComponent {
  readonly name = input.required<IconName>();
  readonly label = input<string>();
  readonly size = input<number>(22);
  /**
   * Die Strichstärke. Die Zeichen der Ebenen tragen mehr Linien auf gleicher
   * Fläche; ein dünnerer Strich hält sie auf 20 Punkten noch lesbar.
   */
  readonly strich = input<number>(2);

  protected readonly filled = computed(() => FILLED.includes(this.name()));
  protected readonly viewBox = computed(() => (this.filled() ? '0 0 12 12' : '0 0 24 24'));
  protected readonly role = computed(() => (this.label() ? 'img' : null));
  protected readonly hidden = computed(() => (this.label() ? null : true));
}
