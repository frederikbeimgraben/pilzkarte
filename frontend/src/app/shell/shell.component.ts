import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionState } from '../core/auth';
import { ViewportService } from '../core/layout/viewport.service';
import { I18nService } from '../core/i18n/i18n.service';
// Diese Datei laedt beim Start mit. Sie nimmt die Bausteine darum einzeln
// und nicht ueber `ui/index.ts`: das Sammelmodul zieht jeden Baustein in das
// erste Buendel, auch die Saisonkurve und die Zeitleiste, die hier niemand
// braucht. Das waren 81 kB.
import { AvatarButtonComponent } from '../ui/avatar-button/avatar-button.component';
import { NavComponent } from '../ui/nav/nav.component';
import { BannerComponent } from '../ui/banner/banner.component';
import { MapComponent } from '../features/map/map.component';
import { MapState } from '../features/map/map.state';
import { AddEntryState } from '../features/add-entry/add-entry.state';
import { SyncService } from '../core/offline/sync.service';
import { PwaService } from '../core/pwa/pwa.service';

/** Reiter, die am Rechner ihre eigenen Spalten mitbringen. */
const FULL_WIDTH: readonly string[] = ['/verwaltung', '/arten'];

/** Wege ohne Reiterleiste. Die Regel steht am Weg, nicht in der Seite. */
const WITHOUT_NAV: readonly RegExp[] = [
  /^\/bausteine(\/|$)/,
  /^\/arten\/[^/]+/,
  /^\/verwaltung(\/|$)/,
  /^\/konto\/[^/]+/,
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
  imports: [AvatarButtonComponent, NavComponent, BannerComponent, MapComponent, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly viewport = inject(ViewportService);
  private readonly session = inject(SessionState);
  private readonly map = inject(MapState);
  private readonly addEntry = inject(AddEntryState);
  private readonly sync = inject(SyncService);
  private readonly pwa = inject(PwaService);

  protected readonly updateReady = this.pwa.updateReady;

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

  protected readonly showAvatar = this.onTheMap;

  /** Ob die Karte ihre eigene Zustandsleiste zeigt: kein Netz auf dem Reiter Karte. */
  private readonly mapOffline = computed(() => this.onTheMap() && !this.sync.online());

  /** Höhe der sichtbaren oberen Leiste: schiebt schwebende Elemente und Seitenkopf. */
  protected readonly topBarHeight = computed(() =>
    this.updateReady() || this.mapOffline() ? 'calc(38px + env(safe-area-inset-top, 0px))' : '0px',
  );

  /**
   * Die Verwaltung trägt am Rechner ihre eigenen zwei Spalten und braucht dafür
   * die ganze Fläche, nicht nur die linke.
   */
  protected readonly fullWidth = computed(() => FULL_WIDTH.includes(this.active()));

  /** Kein Reiter, keine Leiste darunter. Am Rechner bleibt die Schiene. */
  protected readonly bare = computed(() => {
    const path = this.adresse().split(/[?#]/)[0];
    return !this.wide() && WITHOUT_NAV.some((rule) => rule.test(path));
  });

  /**
   * Solange ein Blatt der Karte offen ist, liegt die Karte über dem Reiter.
   * Die Knöpfe der Karte stehen am Rechner auf jedem Reiter; ihre Blätter
   * gehören in die linke Spalte und müssten sonst hinter dem Reiter bleiben.
   */
  protected readonly mapInFront = computed(() => this.map.layersSheetOpen() || this.addEntry.running());

  /** Buchstabe des Namens, als Gast „G“, bei offener Sitzung `null`. */
  protected readonly avatarName = computed(() => {
    if (this.session.status() === 'unknown') return null;
    return this.session.name() ?? this.i18n.translate('konto.gast');
  });

  protected readonly avatarLabel = computed(() => {
    const name = this.session.status() === 'signedIn' ? this.session.name() : null;
    return name === null
      ? this.i18n.translate('nav.konto')
      : this.i18n.translate('konto.avatarAngemeldet', { name });
  });

  protected toAccount(): void {
    void this.router.navigate(['/konto']);
  }

  protected reload(): void {
    void this.pwa.activate();
  }
}
