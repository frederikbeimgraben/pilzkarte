import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Eine Zahl mit Bezug: links wozu sie gehört, darunter worauf sie sich
 * bezieht, rechts der Wert.
 */
@Component({
  selector: 'app-metric-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metric-row.component.html',
  styleUrl: './metric-row.component.scss',
})
export class MetricRowComponent {
  readonly beschriftung = input.required<string>();
  readonly unter = input<string>();
  readonly wert = input.required<string>();
}
