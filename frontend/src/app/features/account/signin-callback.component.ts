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
  selector: 'app-signin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './signin-callback.component.html',
  styleUrl: './signin-callback.component.scss',
})
export class SignInCallbackComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly failure = signal(false);

  constructor() {
    void this.finish();
  }

  protected toMap(): void {
    void this.router.navigateByUrl('/karte');
  }

  private async finish(): Promise<void> {
    try {
      await this.router.navigateByUrl(await this.auth.completeSignIn());
    } catch {
      // Ein abgelaufener oder doppelt eingelöster Code endet hier. Die Seite
      // sagt es und lässt den Weg zurück zur Karte offen.
      this.failure.set(true);
    }
  }
}
