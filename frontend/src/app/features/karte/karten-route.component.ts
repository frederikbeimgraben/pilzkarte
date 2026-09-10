import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AnsichtDienst } from '../../core/layout/ansicht.service';
import { KarteComponent } from './karte.component';

/**
 * Der Reiter Karte als Route.
 *
 * Am Telefon füllt die Karte den Reiter. Am Rechner steht sie schon in der
 * Hülle und läuft weiter, während links ein anderer Reiter liegt; dort liefert
 * diese Route nichts, sonst gäbe es die Karte zweimal und den Adapter dazu.
 */
@Component({
  selector: 'app-karten-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KarteComponent],
  templateUrl: './karten-route.component.html',
})
export class KartenRouteComponent {
  protected readonly breit = inject(AnsichtDienst).breit;
}
