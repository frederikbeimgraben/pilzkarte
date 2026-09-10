import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Die Piktogramme der Mockups. Strich auf 24er-Raster, Pfeile auf 12er. */
export type PiktogrammName =
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
  | 'leer'
  | 'links'
  | 'rechts'
  | 'abspielen';

/** Die drei gefüllten Pfeile der Kopfzeile sitzen auf einem 12er-Raster. */
const GEFUELLT: readonly PiktogrammName[] = ['links', 'rechts', 'abspielen'];

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
  readonly name = input.required<PiktogrammName>();
  readonly beschriftung = input<string>();
  readonly groesse = input<number>(22);

  protected readonly gefuellt = computed(() => GEFUELLT.includes(this.name()));
  protected readonly viewBox = computed(() => (this.gefuellt() ? '0 0 12 12' : '0 0 24 24'));
  protected readonly rolle = computed(() => (this.beschriftung() ? 'img' : null));
  protected readonly versteckt = computed(() => (this.beschriftung() ? null : true));
}
