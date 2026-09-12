import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, CardComponent } from '@stupa-makers/ui-kit';
import { PermissionsService } from '../../core/access/permissions.service';
import { AuthService, type SignedInUser } from '../../core/auth';
import { ConfigService } from '../../core/config/config.service';
import { I18nService, LANGUAGE_CHOICES, type LanguageChoice } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService, type ThemeChoice } from '../../core/theme/theme.service';
import { ListRowComponent, PageHeaderComponent, SegmentedComponent, type SegmentOption } from '../../ui';
import { ADMIN_PERMISSIONS } from '../admin/admin.guard';

/** Die drei Wahlmöglichkeiten der Darstellung, in der Reihenfolge des Artboards. */
const THEMES: readonly ThemeChoice[] = ['hell', 'dunkel', 'system'];

/**
 * Der Konto-Screen (Artboard `Mehr`): wer angemeldet ist, Darstellung, Offline
 * und Über. Er ist auch ohne Anmeldung vollständig bedienbar; nur die
 * Konto-Karte wechselt ihren Inhalt.
 *
 * Die Zahlen unter „Offline“ stehen auf null, bis F1 die Warteschlange und die
 * Gebiete liefert. Sie stehen trotzdem hier, weil der Screen sonst zweimal
 * gebaut würde.
 */
@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    ListRowComponent,
    PageHeaderComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly rights = inject(PermissionsService);

  protected readonly user = this.auth.user;
  /** Ohne ein Recht der Verwaltung fehlt der Punkt ganz. */
  protected readonly canAdminister = computed(() => this.rights.canAny(ADMIN_PERMISSIONS));
  protected readonly signedIn = this.auth.signedIn;
  protected readonly choice = this.theme.choice;
  protected readonly languageChoice = this.i18n.choice;

  /**
   * Deutsch, Englisch oder der Browser. Die Wahl steht neben der Darstellung,
   * weil beides dasselbe ist: wie die App aussieht, nicht was in ihr steht.
   */
  protected readonly languages = computed<SegmentOption[]>(() =>
    LANGUAGE_CHOICES.map((value) => ({ value, label: this.i18n.translate(`sprache.${value}`) })),
  );

  protected selectLanguage(value: string): void {
    const selected = LANGUAGE_CHOICES.find((candidate) => candidate === value);
    if (selected) this.i18n.setChoice(selected satisfies LanguageChoice);
  }

  protected initiale(person: SignedInUser): string {
    return person.name.trim().charAt(0).toUpperCase();
  }

  /** „frederik@beimgraben.net · sso.beimgraben.net“, wie im Artboard. */
  protected accountSubline(person: SignedInUser): string {
    return this.i18n.translate('konto.nutzerUnter', {
      email: person.email,
      aussteller: this.aussteller(),
    });
  }

  protected readonly version = computed(
    () => this.config.configuration()?.version ?? this.i18n.translate('konto.unbekannt'),
  );

  protected readonly themes = computed<SegmentOption[]>(() =>
    THEMES.map((choice) => ({ value: choice, label: this.i18n.translate(`theme.${choice}`) })),
  );

  protected back(): void {
    void this.router.navigateByUrl('/karte');
  }

  protected toAdministration(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  protected signIn(): void {
    void this.auth.signIn('/konto');
  }

  protected signOut(): void {
    void this.auth.signOut();
  }

  protected selectTheme(value: string): void {
    const choice = THEMES.find((candidate) => candidate === value);
    if (choice) this.theme.setChoice(choice);
  }

  /** Der Wirt des Issuers sagt kürzer als die volle URL, wo das Konto liegt. */
  private aussteller(): string {
    const issuer = this.config.configuration()?.oidcIssuer ?? '';
    try {
      return new URL(issuer).host;
    } catch {
      // Ein Issuer, der keine URL ist, steht so da, wie er gekommen ist.
      return issuer;
    }
  }
}
