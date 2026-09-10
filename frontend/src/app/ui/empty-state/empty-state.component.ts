import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { SvgIconComponent, type PiktogrammName } from '../svg-icon/svg-icon.component';

/**
 * Der Leerzustand einer Liste: ein Bild, darunter ein Satz, darunter die
 * Handlung, wenn es eine gibt. Alles mittig und ruhig.
 *
 * Vorher sah jede Liste anders leer aus: einmal ein zentrierter Satz in einem
 * Kasten, einmal ein linksbündiger ohne. Ein Rahmen um einen Satz liest sich
 * wie ein Fehler, ein Satz allein wie ein vergessener Platzhalter.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SvgIconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly text = input.required<string>();
  /** Das Bild über dem Satz. Ohne Angabe steht dort der leere Korb. */
  readonly icon = input<PiktogrammName>('leer');
  /** Die Beschriftung des Knopfs. Ohne sie bleibt der Leerzustand ein Satz. */
  readonly action = input<string>();

  readonly actionClick = output();
}
