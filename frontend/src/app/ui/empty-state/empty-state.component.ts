import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';

/**
 * Der Leerzustand einer Liste: ein ruhiger Satz, links im Textmaß der Liste,
 * darunter der Weg heraus.
 *
 * Ohne diesen Baustein stand er einmal zentriert in einem Kasten und einmal
 * linksbündig ohne. Ein Rahmen um einen Satz sieht aus wie ein Fehler.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly text = input.required<string>();
  /** Die Beschriftung des Knopfs. Ohne sie bleibt der Leerzustand ein Satz. */
  readonly action = input<string>();

  readonly actionClick = output();
}
