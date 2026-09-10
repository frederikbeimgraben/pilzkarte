import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SvgIconComponent, type PiktogrammName } from '../svg-icon/svg-icon.component';

/** Ein Reiter der unteren Navigation. */
export interface NavEintrag {
  pfad: string;
  label: string;
  icon: PiktogrammName;
}

/** Unten am Telefon, oben in der Spalte am Rechner (Artboard `Desktop`). */
export type NavVariante = 'unten' | 'spalte';

/**
 * Die Navigation, 64 px hoch. Der aktive Reiter wird als Eingabe gesetzt und
 * nicht aus der Route geraten, damit die Leiste in jedem Umfeld dasselbe zeigt.
 */
@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SvgIconComponent],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  readonly eintraege = input.required<readonly NavEintrag[]>();
  readonly aktiv = input<string | null>(null);
  readonly beschriftung = input.required<string>();
  readonly variante = input<NavVariante>('unten');
}
