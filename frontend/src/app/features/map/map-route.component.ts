import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { MapComponent } from './map.component';

/**
 * Der Reiter Karte als Route.
 *
 * Am Telefon füllt die Karte den Reiter. Am Rechner steht sie schon in der
 * Hülle und läuft weiter, während links ein anderer Reiter liegt; dort liefert
 * diese Route nichts, sonst gäbe es die Karte zweimal und den Adapter dazu.
 */
@Component({
  selector: 'app-map-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapComponent],
  templateUrl: './map-route.component.html',
})
export class MapRouteComponent {
  protected readonly wide = inject(ViewportService).wide;
}
