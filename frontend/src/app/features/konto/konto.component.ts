import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, CardComponent } from '@stupa-makers/ui-kit';
import { AuthService, type AngemeldeterNutzer } from '../../core/auth';
import { ConfigService } from '../../core/config/config.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService, type ThemeWahl } from '../../core/theme/theme.service';
import { ListRowComponent, PageHeaderComponent, SegmentedComponent, type SegmentOption } from '../../ui';

/** Die drei Wahlmöglichkeiten der Darstellung, in der Reihenfolge des Artboards. */
const THEMEN: readonly ThemeWahl[] = ['hell', 'dunkel', 'system'];

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
  selector: 'app-konto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    ListRowComponent,
    PageHeaderComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './konto.component.html',
  styleUrl: './konto.component.scss',
})
export class KontoComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  protected readonly nutzer = this.auth.nutzer;
  protected readonly angemeldet = this.auth.angemeldet;
  protected readonly wahl = this.theme.wahl;

  protected initiale(person: AngemeldeterNutzer): string {
    return person.name.trim().charAt(0).toUpperCase();
  }

  /** „frederik@beimgraben.net · sso.beimgraben.net“, wie im Artboard. */
  protected kontoUnter(person: AngemeldeterNutzer): string {
    return this.i18n.translate('konto.nutzerUnter', {
      email: person.email,
      aussteller: this.aussteller(),
    });
  }

  protected readonly version = computed(
    () => this.config.konfiguration()?.version ?? this.i18n.translate('konto.unbekannt'),
  );

  protected readonly themen = computed<SegmentOption[]>(() =>
    THEMEN.map((wahl) => ({ wert: wahl, label: this.i18n.translate(`theme.${wahl}`) })),
  );

  protected zurueck(): void {
    void this.router.navigateByUrl('/karte');
  }

  protected anmelden(): void {
    void this.auth.anmelden('/konto');
  }

  protected abmelden(): void {
    void this.auth.abmelden();
  }

  protected waehleTheme(wert: string): void {
    const wahl = THEMEN.find((kandidat) => kandidat === wert);
    if (wahl) this.theme.setWahl(wahl);
  }

  /** Der Wirt des Issuers sagt kürzer als die volle URL, wo das Konto liegt. */
  private aussteller(): string {
    const issuer = this.config.konfiguration()?.oidcIssuer ?? '';
    try {
      return new URL(issuer).host;
    } catch {
      // Ein Issuer, der keine URL ist, steht so da, wie er gekommen ist.
      return issuer;
    }
  }
}
