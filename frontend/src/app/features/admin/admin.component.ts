import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import { filter, map } from 'rxjs';
import { PermissionsService } from '../../core/access/permissions.service';
import type { Permission } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import {
  EmptyStateComponent,
  ListRowComponent,
  NoteComponent,
  PageHeaderComponent,
  SvgIconComponent,
} from '../../ui';
import { AdminState } from './admin.state';

/** Ein Punkt der Verwaltung: das Recht dazu, der Abschnitt und der Weg. */
interface AdminEntry {
  titel: TranslationKey;
  subline: TranslationKey;
  permission: Permission;
  section: 'inhalte' | 'zugang';
  /** Ohne Weg steht der Punkt da, aber sein Arbeitspaket fehlt noch. */
  path: string | null;
  paket: string | null;
}

const ENTRIES: readonly AdminEntry[] = [
  {
    titel: 'verwaltung.texte',
    subline: 'verwaltung.texteUnter',
    permission: 'text.edit',
    section: 'inhalte',
    path: '/verwaltung/texte',
    paket: null,
  },
  {
    titel: 'verwaltung.bilder',
    subline: 'verwaltung.bilderUnter',
    permission: 'image.review',
    section: 'inhalte',
    path: null,
    paket: 'I3',
  },
  {
    titel: 'verwaltung.arten',
    subline: 'verwaltung.artenUnter',
    permission: 'species.edit',
    section: 'inhalte',
    path: null,
    paket: 'J1',
  },
  {
    titel: 'verwaltung.rollen',
    subline: 'verwaltung.rollenUnter',
    permission: 'role.manage',
    section: 'zugang',
    path: '/verwaltung/rollen',
    paket: null,
  },
  {
    titel: 'verwaltung.personen',
    subline: 'verwaltung.personenUnter',
    permission: 'role.assign',
    section: 'zugang',
    path: '/verwaltung/personen',
    paket: null,
  },
];

/** Eine Zeile, fertig für die Vorlage. */
interface Row {
  titel: string;
  subline: string;
  notiz: string | undefined;
  path: string | null;
}

/**
 * Der Bereich Verwaltung unter dem Konto (Artboard `Verwaltung`).
 *
 * Am Telefon ist die Liste die Seite; ein Punkt führt weiter. Am Rechner steht
 * die Liste links und der gewählte Punkt rechts, beide zugleich.
 *
 * Ein Punkt erscheint nur mit dem passenden Recht. Die Prüfung bleibt beim
 * Server: hier wird nur ausgeblendet.
 */
@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    EmptyStateComponent,
    ListRowComponent,
    NoteComponent,
    PageHeaderComponent,
    RouterOutlet,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly i18n = inject(I18nService);
  private readonly rights = inject(PermissionsService);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);
  private readonly viewport = inject(ViewportService);

  protected readonly wide = this.viewport.wide;

  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Ein gewählter Punkt schiebt am Telefon die Liste beiseite. */
  protected readonly onEntry = computed(() => this.address().startsWith('/verwaltung/'));
  protected readonly showList = computed(() => this.wide() || !this.onEntry());

  protected readonly content = computed(() => this.rows('inhalte'));
  protected readonly access = computed(() => this.rows('zugang'));
  protected readonly empty = computed(() => this.content().length + this.access().length === 0);

  constructor() {
    // Die Zeile „Rollen“ nennt, wie viele es sind. Beides steht hinter dem Recht,
    // Rollen zu verwalten.
    effect(() => {
      if (this.rights.can('role.manage')) {
        this.state.loadRoles();
        this.state.loadCatalogue();
      }
    });
  }

  protected open(path: string | null): void {
    if (path !== null) void this.router.navigateByUrl(path);
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }

  private rows(section: AdminEntry['section']): Row[] {
    return ENTRIES.filter((entry) => entry.section === section && this.rights.can(entry.permission)).map(
      (entry) => ({
        titel: this.i18n.translate(entry.titel),
        subline: this.subline(entry),
        notiz:
          entry.paket === null
            ? undefined
            : this.i18n.translate('verwaltung.spaeter', { paket: entry.paket }),
        path: entry.path,
      }),
    );
  }

  /** Die Zeile „Rollen“ zählt, sobald Liste und Katalog da sind. */
  private subline(entry: AdminEntry): string {
    const roles = this.state.roles();
    const catalogue = this.state.catalogue();
    if (entry.subline !== 'verwaltung.rollenUnter' || roles === null || catalogue === null) {
      return this.i18n.translate(entry.subline);
    }
    return this.i18n.translate('verwaltung.rollenUnter', {
      rollen: roles.length,
      rechte: catalogue.length,
    });
  }
}
