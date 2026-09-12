import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/**
 * Der Leerzustand einer Liste: ein Bild, darunter ein Satz, darunter die
 * Handlung, wenn es eine gibt. Alles mittig und ruhig.
 *
 * Der Knopf ist abgesetzt, nicht gefüllt. Was hier steht, ist ein Angebot und
 * nicht der Zweck des Bildschirms; gefüllt war er das lauteste Element der
 * Seite für eine Nebenhandlung.
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
  readonly icon = input<IconName>('leer');
  /** Die Beschriftung des Knopfs. Ohne sie bleibt der Leerzustand ein Satz. */
  readonly action = input<string>();

  readonly actionClick = output();
}
