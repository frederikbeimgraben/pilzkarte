import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Der Kreis oben links auf der Karte. Er führt zum Konto. */
@Component({
  selector: 'app-avatar-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar-button.component.html',
  styleUrl: './avatar-button.component.scss',
})
export class AvatarButtonComponent {
  readonly name = input.required<string>();
  readonly label = input.required<string>();

  readonly pressed = output();

  protected readonly initiale = computed(() => this.name().trim().charAt(0).toUpperCase());
}
