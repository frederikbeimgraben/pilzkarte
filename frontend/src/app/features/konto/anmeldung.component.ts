import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Die Rückkehr vom SSO. Der Code wird gegen die Token getauscht, danach führt
 * der Weg auf die Route zurück, auf der die Anmeldung begonnen hat.
 */
@Component({
  selector: 'app-anmeldung',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './anmeldung.component.html',
  styleUrl: './anmeldung.component.scss',
})
export class AnmeldungComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly fehler = signal(false);

  constructor() {
    void this.abschliessen();
  }

  protected zurKarte(): void {
    void this.router.navigateByUrl('/karte');
  }

  private async abschliessen(): Promise<void> {
    try {
      await this.router.navigateByUrl(await this.auth.anmeldungAbschliessen());
    } catch {
      // Ein abgelaufener oder doppelt eingelöster Code endet hier. Die Seite
      // sagt es und lässt den Weg zurück zur Karte offen.
      this.fehler.set(true);
    }
  }
}
