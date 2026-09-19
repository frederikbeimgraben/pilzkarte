import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ListRowComponent } from '../list-row/list-row.component';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { ScrollFadeDirective } from '../scroll-fade/scroll-fade.directive';
import { SheetComponent, type Detent, type DetentSize } from '../sheet/sheet.component';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Eine Zeile zur Wahl: Zeichen, Titel und ihr Wert. */
export interface OptionSheetOption {
  readonly id: string;
  readonly title: string;
  readonly icon?: IconName;
  readonly value?: string;
}

/** Ohne Vorgabe fasst das Blatt nur seinen Inhalt. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];

/** Blatt zur Einfachwahl: Kopf mit Titel und Schließen, darunter eine Karte aus Zeilen. */
@Component({
  selector: 'app-option-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    OverlayHostComponent,
    ScrollFadeDirective,
    SheetComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './option-sheet.component.html',
  styleUrl: './option-sheet.component.scss',
})
export class OptionSheetComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly options = input.required<readonly OptionSheetOption[]>();
  /** Die gewählte Zeile trägt einen Haken statt eines Pfeils. */
  readonly selected = input<string | null>(null);
  readonly detents = input<readonly [DetentSize, DetentSize, DetentSize]>(DETENTS);
  readonly detent = input<Detent>(2);
  /** Ein Blatt über eigenem Grund dunkelt ihn ab; eines über der Karte nicht. */
  readonly dims = input(true);

  readonly chosen = output<string>();
  readonly closed = output();
}
