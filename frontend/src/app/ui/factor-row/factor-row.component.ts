import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';

let nextNumber = 0;

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
  readonly subline = input<string>();
  readonly condition = input.required<string>();
  readonly active = input(false);

  readonly activeChange = output<boolean>();
  readonly conditionClick = output();

  protected readonly fieldId = `app-factor-${nextNumber++}`;
}
