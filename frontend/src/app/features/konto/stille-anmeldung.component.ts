import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth';

/**
 * Die Rückkehr der stillen Erneuerung. Diese Route lädt nur im iframe, meldet
 * das Ergebnis an das Fenster darüber und zeigt darum nichts.
 */
@Component({
  selector: 'app-stille-anmeldung',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class StilleAnmeldungComponent {
  private readonly auth = inject(AuthService);

  constructor() {
    void this.auth.stillenCallbackVerarbeiten();
  }
}
