import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent, CardComponent, DialogComponent } from '@stupa-makers/ui-kit';
import { map } from 'rxjs';
import type { Permission, PermissionArea, Role } from '../../core/api/models';
import { PERMISSION_AREAS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ActionBarComponent,
  CheckRowComponent,
  FormFieldComponent,
  NoteComponent,
  PageHeaderComponent,
} from '../../ui';
import { AdminState } from './admin.state';
import { AREA_TEXT, PERMISSION_NOTE, PERMISSION_TEXT } from './labels';

/** Der Weg, unter dem eine neue Rolle angelegt wird. */
export const NEW_ROLE = 'neu';

/** Ein Recht in der Matrix. */
interface Right {
  key: Permission;
  titel: string;
  subline: string | undefined;
  checked: boolean;
}

/** Eine Gruppe der Matrix, nach Bereich. */
interface Area {
  area: PermissionArea;
  titel: string;
  rights: Right[];
}

/**
 * Eine Rolle anlegen oder ändern (Artboard `Rolle`): Name, Beschreibung und
 * die Rechtematrix nach Bereich.
 *
 * Die feste Rolle Admin und die feste Rolle Nutzer stehen hier zum Lesen. Admin
 * trägt jedes Recht, auch jedes neu eingeführte; das lässt sich nicht anhaken
 * und nicht abwählen, sonst wäre es beim nächsten neuen Recht schon veraltet.
 */
@Component({
  selector: 'app-role',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ButtonComponent,
    CardComponent,
    CheckRowComponent,
    DialogComponent,
    FormFieldComponent,
    NoteComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './role.component.html',
  styleUrl: './role.component.scss',
})
export class RoleComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? NEW_ROLE)), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? NEW_ROLE,
  });

  protected readonly creating = computed(() => this.id() === NEW_ROLE);
  protected readonly role = computed<Role | null>(
    () => this.state.roles()?.find((one) => one.id === this.id()) ?? null,
  );
  /** Eine Kennung, die es nicht gibt: die Liste ist da, die Rolle nicht. */
  protected readonly missing = computed(
    () => !this.creating() && this.state.roles() !== null && this.role() === null,
  );
  protected readonly locked = computed(() => this.role()?.builtIn === true);

  protected readonly name = signal('');
  protected readonly slug = signal('');
  protected readonly description = signal('');
  protected readonly chosen = signal<ReadonlySet<Permission>>(new Set());
  protected readonly confirming = signal(false);
  /** Ein zweiter Druck auf Speichern legte die Rolle ein zweites Mal an. */
  protected readonly saving = signal(false);

  /** Der Kopf trägt den Namen der Rolle, eine neue trägt „Neue Rolle“. */
  protected readonly title = computed(
    () => this.role()?.name ?? this.i18n.translate(this.creating() ? 'rolle.neu' : 'rollen.titel'),
  );

  protected readonly ready = computed(() => this.name().trim().length > 0 && this.slug().trim().length > 0);

  protected readonly areas = computed<Area[]>(() => {
    const catalogue = this.state.catalogue() ?? [];
    const held = this.chosen();
    return PERMISSION_AREAS.map((area) => ({
      area,
      titel: this.i18n.translate(AREA_TEXT[area]),
      rights: catalogue
        .filter((entry) => entry.area === area)
        .map((entry) => ({
          key: entry.key,
          titel: this.i18n.translate(PERMISSION_TEXT[entry.key]),
          subline: this.note(entry.key),
          checked: this.locked()
            ? this.role()?.permissions.includes(entry.key) === true
            : held.has(entry.key),
        })),
    })).filter((group) => group.rights.length > 0);
  });

  protected readonly deleteQuestion = computed(() =>
    this.i18n.translate('rolle.loeschenFrage', { name: this.role()?.name ?? '' }),
  );

  constructor() {
    this.state.loadRoles();
    this.state.loadCatalogue();
    // Die Felder folgen der Rolle, sobald sie da ist. Danach führt die Eingabe:
    // sonst überschriebe jede Antwort des Servers, was gerade getippt wird.
    let seeded: string | null = null;
    effect(() => {
      const role = this.role();
      if (role === null || seeded === role.id) return;
      seeded = role.id;
      this.name.set(role.name);
      this.slug.set(role.slug);
      this.description.set(role.description ?? '');
      this.chosen.set(new Set(role.permissions));
    });
  }

  protected toggle(permission: Permission, on: boolean): void {
    this.chosen.update((held) => {
      const next = new Set(held);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  protected save(): void {
    if (!this.ready() || this.saving()) return;
    this.saving.set(true);
    const permissions = [...this.chosen()];
    const description = this.description().trim() || null;
    const request = this.creating()
      ? this.state.createRole({
          slug: this.slug().trim(),
          name: this.name().trim(),
          description,
          permissions,
        })
      : this.state.patchRole(this.id(), { name: this.name().trim(), description, permissions });
    request.subscribe({
      next: () => {
        this.leave();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected remove(): void {
    this.confirming.set(false);
    this.state.deleteRole(this.id()).subscribe(() => {
      this.leave();
    });
  }

  protected back(): void {
    this.leave();
  }

  private leave(): void {
    void this.router.navigateByUrl('/verwaltung/rollen');
  }

  private note(permission: Permission): string | undefined {
    const key = PERMISSION_NOTE[permission];
    return key === undefined ? undefined : this.i18n.translate(key);
  }
}
