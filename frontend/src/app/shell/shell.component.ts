import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth';
import { AnsichtDienst } from '../core/layout/ansicht.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { I18nService } from '../core/i18n/i18n.service';
import { AvatarButtonComponent, BottomNavComponent, type NavEintrag } from '../ui';

/** Die drei Reiter. Das Konto hängt am Avatar über der Karte, nicht an der Leiste. */
const REITER: readonly {
  pfad: string;
  schluessel: 'nav.karte' | 'nav.arten' | 'nav.eintraege';
  icon: NavEintrag['icon'];
}[] = [
  { pfad: '/karte', schluessel: 'nav.karte', icon: 'karte' },
  { pfad: '/arten', schluessel: 'nav.arten', icon: 'arten' },
  { pfad: '/eintraege', schluessel: 'nav.eintraege', icon: 'funde' },
];

/**
 * Die Hülle um jeden Reiter: Navigation und der Avatar über der Karte.
 * Am Telefon steht die Leiste unten, ab 1024 px oben in der linken Spalte.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarButtonComponent, BottomNavComponent, RouterOutlet, TranslatePipe],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly ansicht = inject(AnsichtDienst);
  private readonly auth = inject(AuthService);

  private readonly adresse = toSignal(
    this.router.events.pipe(
      filter((ereignis) => ereignis instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly breit = this.ansicht.breit;

  /** Der erste Abschnitt der Adresse, ohne Abfrage: `/karte?art=…` → `/karte`. */
  protected readonly aktiv = computed(() => `/${this.adresse().split(/[?#/]/)[1] || 'karte'}`);

  protected readonly aufDerKarte = computed(() => this.aktiv() === '/karte');

  /** Angemeldet trägt der Kreis den ersten Buchstaben des Namens, sonst „G“. */
  protected readonly avatarName = computed(
    () => this.auth.nutzer()?.name ?? this.i18n.translate('konto.gast'),
  );

  protected readonly avatarBeschriftung = computed(() => {
    const person = this.auth.nutzer();
    return person === null
      ? this.i18n.translate('nav.konto')
      : this.i18n.translate('konto.avatarAngemeldet', { name: person.name });
  });

  protected readonly eintraege = computed<NavEintrag[]>(() =>
    REITER.map((reiter) => ({
      pfad: reiter.pfad,
      label: this.i18n.translate(reiter.schluessel),
      icon: reiter.icon,
    })),
  );

  protected zumKonto(): void {
    void this.router.navigate(['/konto']);
  }
}
