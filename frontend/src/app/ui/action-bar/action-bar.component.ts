import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent, type ButtonVariant } from '@stupa-makers/ui-kit';

/**
 * Der Fuß trägt oben die Hauptaktion und darunter höchstens eine zweite.
 */
@Component({
  selector: 'app-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.scss',
})
export class ActionBarComponent {
  readonly primary = input.required<string>();
  readonly secondary = input<string>();
  /** Färbt die Hauptaktion rot statt grün, etwa für „Alles löschen“. */
  readonly danger = input(false);
  /** Färbt die zweite Aktion rot, etwa für „Faktor entfernen“. */
  readonly secondaryDanger = input(false);
  /** Im Modal stehen die Knöpfe nebeneinander am rechten Rand. */
  readonly inline = input(false);
  /** Zwei gleichrangige Wege: die erste Aktion trägt kein Gewicht. */
  readonly quiet = input(false);
  /** Die letzte Aktion steht ohne Rahmen und misst vierundvierzig Punkte. */
  readonly ghost = input(false);
  /** Die Hauptaktion läuft schon: Spinner statt Text, kein zweiter Auftrag. */
  readonly busy = input(false);

  readonly primaryClick = output();
  readonly secondaryClick = output();

  protected readonly primaryVariant = computed<ButtonVariant>(() => {
    if (this.danger()) return 'danger';
    if (this.ghost() && this.secondary() === undefined) return 'ghost';
    return this.quiet() ? 'secondary' : 'primary';
  });

  protected readonly secondaryVariant = computed<ButtonVariant>(() => {
    if (this.secondaryDanger()) return 'danger-outline';
    return this.ghost() ? 'ghost' : 'secondary';
  });
}
