import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth';
import { AnsichtDienst } from '../core/layout/ansicht.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { I18nService } from '../core/i18n/i18n.service';
import { AvatarButtonComponent, BottomNavComponent, type NavEintrag } from '../ui';
import { KarteComponent } from '../features/karte/karte.component';

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
 * Die Hülle um jeden Reiter: Navigation, Inhalt und der Avatar über der Karte.
 *
 * Am Telefon steht die Leiste unten und der Reiter füllt den Rest. Ab 1024 px
 * trägt die linke Spalte Navigation und Reiterinhalt, rechts läuft die Karte.
 * Sie hängt hier und nicht am Reiter Karte, damit sie beim Wechsel auf Arten
 * oder Einträge stehen bleibt, statt neu zu laden. Auf den anderen Reitern
 * zeigt sie nur ihre Fläche; das Blatt gehört dem Reiter Karte.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarButtonComponent, BottomNavComponent, KarteComponent, RouterOutlet, TranslatePipe],
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
