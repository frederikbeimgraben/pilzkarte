import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth';
import { ViewportService } from '../core/layout/viewport.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { I18nService } from '../core/i18n/i18n.service';
// Diese Datei laedt beim Start mit. Sie nimmt die Bausteine darum einzeln
// und nicht ueber `ui/index.ts`: das Sammelmodul zieht jeden Baustein in das
// erste Buendel, auch die Saisonkurve und die Zeitleiste, die hier niemand
// braucht. Das waren 81 kB.
import { AvatarButtonComponent } from '../ui/avatar-button/avatar-button.component';
import { BottomNavComponent, type NavItem } from '../ui/bottom-nav/bottom-nav.component';
import { MapComponent } from '../features/map/map.component';
import { MapState } from '../features/map/map.state';
import { AddEntryState } from '../features/add-entry/add-entry.state';

/** Die drei Reiter. Das Konto hängt am Avatar über der Karte, nicht an der Leiste. */
const TABS: readonly {
  path: string;
  schluessel: 'nav.karte' | 'nav.arten' | 'nav.eintraege';
  icon: NavItem['icon'];
}[] = [
  { path: '/karte', schluessel: 'nav.karte', icon: 'karte' },
  { path: '/arten', schluessel: 'nav.arten', icon: 'arten' },
  { path: '/eintraege', schluessel: 'nav.eintraege', icon: 'funde' },
];

/**
 * Die Hülle um jeden Reiter: Navigation, Inhalt und der Avatar über der Karte.
 *
 * Am Telefon steht die Leiste unten und der Reiter füllt den Rest. Ab 1024 px
 * trägt die linke Spalte Navigation und Reiterinhalt, rechts läuft die Karte.
 * Sie hängt hier und nicht am Reiter Karte, damit sie beim Wechsel auf Arten
 * oder Einträge stehen bleibt, statt neu zu laden. Auf den anderen Reitern
 * zeigt sie nur ihre Fläche; das Blatt gehört dem Reiter Karte. Ihre Knöpfe
 * bleiben dort trotzdem stehen: sie gehören der Karte, und die steht dauerhaft.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarButtonComponent, BottomNavComponent, MapComponent, RouterOutlet, TranslatePipe],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly viewport = inject(ViewportService);
  private readonly auth = inject(AuthService);
  private readonly map = inject(MapState);
  private readonly addEntry = inject(AddEntryState);

  private readonly adresse = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly wide = this.viewport.wide;

  /** Der erste Abschnitt der Adresse, ohne Abfrage: `/karte?art=…` → `/karte`. */
  protected readonly active = computed(() => `/${this.adresse().split(/[?#/]/)[1] || 'karte'}`);

  protected readonly onTheMap = computed(() => this.active() === '/karte');

  /**
   * Die Verwaltung trägt am Rechner ihre eigenen zwei Spalten und braucht dafür
   * die ganze Fläche, nicht nur die linke.
   */
  protected readonly fullWidth = computed(() => this.active() === '/verwaltung');

  /**
   * Solange ein Blatt der Karte offen ist, liegt die Karte über dem Reiter.
   * Die Knöpfe der Karte stehen am Rechner auf jedem Reiter; ihre Blätter
   * gehören in die linke Spalte und müssten sonst hinter dem Reiter bleiben.
   */
  protected readonly mapInFront = computed(() => this.map.layersSheetOpen() || this.addEntry.running());

  /** Angemeldet trägt der Kreis den ersten Buchstaben des Namens, sonst „G“. */
  protected readonly avatarName = computed(() => this.auth.user()?.name ?? this.i18n.translate('konto.gast'));

  protected readonly avatarLabel = computed(() => {
    const person = this.auth.user();
    return person === null
      ? this.i18n.translate('nav.konto')
      : this.i18n.translate('konto.avatarAngemeldet', { name: person.name });
  });

  protected readonly eintraege = computed<NavItem[]>(() =>
    TABS.map((tab) => ({
      path: tab.path,
      label: this.i18n.translate(tab.schluessel),
      icon: tab.icon,
    })),
  );

  protected toAccount(): void {
    void this.router.navigate(['/konto']);
  }
}
