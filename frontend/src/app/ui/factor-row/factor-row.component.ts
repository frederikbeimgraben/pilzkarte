import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';

let naechsteNummer = 0;

/**
 * Ein Faktor der Kombination: an oder aus, Name mit Bezug und rechts die
 * Bedingung. Die Bedingung ist eine Schaltfläche, weil sie den Faktor-Screen
 * öffnet.
 */
@Component({
  selector: 'app-factor-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, FormsModule],
  templateUrl: './factor-row.component.html',
  styleUrl: './factor-row.component.scss',
})
export class FactorRowComponent {
  readonly name = input.required<string>();
  readonly unter = input<string>();
  readonly bedingung = input.required<string>();
  readonly aktiv = input(false);

  readonly aktivChange = output<boolean>();
  readonly bedingungKlick = output();

  protected readonly feldId = `app-factor-${naechsteNummer++}`;
}
