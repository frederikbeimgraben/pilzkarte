import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, CardComponent, DialogComponent } from '@stupa-makers/ui-kit';
import type { Person, Role } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CheckRowComponent,
  EmptyStateComponent,
  FormFieldComponent,
  ListRowComponent,
  NoteComponent,
  PageHeaderComponent,
} from '../../ui';
import { AdminState } from './admin.state';

/** Eine Zeile der Personenliste. */
interface Row {
  sub: string;
  name: string;
  email: string;
  roles: string;
}

/** Eine Rolle im Blatt der Zuweisung. */
interface Choice {
  id: string;
  name: string;
  checked: boolean;
}

/**
 * Die Personenliste (Artboard `Personen`): Suche, Konten und ihre Rollen.
 *
 * Eine Zeile öffnet die Zuweisung. Sie zeigt jede vergebbare Rolle mit einem
 * Haken, wie die Rechtematrix einer Rolle: dieselbe Zeile, dasselbe Bild. Die
 * feste Rolle Nutzer steht nicht darin, sie hat jede angemeldete Person.
 */
@Component({
  selector: 'app-people',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    CheckRowComponent,
    DialogComponent,
    EmptyStateComponent,
    FormFieldComponent,
    ListRowComponent,
    NoteComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './people.component.html',
  styleUrl: './people.component.scss',
})
export class PeopleComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);

  protected readonly search = signal('');
  protected readonly editing = signal<Person | null>(null);
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly saving = signal(false);

  protected readonly loaded = computed(() => this.state.people() !== null);
  protected readonly rows = computed<Row[]>(() =>
    (this.state.people() ?? []).map((person) => ({
      sub: person.sub,
      name: person.name ?? this.i18n.translate('personen.namenlos'),
      email: person.email ?? '',
      roles:
        person.roles.length === 0
          ? this.i18n.translate('personen.nurNutzer')
          : person.roles.map((role) => role.name).join(' · '),
    })),
  );

  protected readonly count = computed(() =>
    this.i18n.translate('personen.anzahl', { anzahl: this.rows().length }),
  );

  /** Nur freie Rollen: die feste Rolle Nutzer wird nicht vergeben. */
  private readonly assignable = computed<readonly Role[]>(() =>
    (this.state.roles() ?? []).filter((role) => role.slug !== 'user'),
  );

  protected readonly choices = computed<Choice[]>(() =>
    this.assignable().map((role) => ({
      id: role.id,
      name: role.name,
      checked: this.chosen().has(role.id),
    })),
  );

  protected readonly dialogTitle = computed(() =>
    this.i18n.translate('personen.rollenTitel', { name: this.editing()?.name ?? '' }),
  );

  constructor() {
    this.state.loadPeople('');
    // Ohne die Rollen bliebe das Blatt der Zuweisung leer. Wer Rollen vergeben
    // darf, darf sie auch lesen.
    this.state.loadRoles();
  }

  protected onSearch(text: string): void {
    this.search.set(text);
    this.state.loadPeople(text.trim());
  }

  protected edit(sub: string): void {
    const person = this.state.people()?.find((one) => one.sub === sub) ?? null;
    this.editing.set(person);
    this.chosen.set(new Set(person?.roles.map((role) => role.id) ?? []));
  }

  protected toggle(id: string, on: boolean): void {
    this.chosen.update((held) => {
      const next = new Set(held);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected save(): void {
    const person = this.editing();
    if (person === null || this.saving()) return;
    this.saving.set(true);
    this.state.setRoles(person.sub, [...this.chosen()]).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
      },
      // Der Dienst weist ab, wer der letzten Person die Rolle Admin nimmt. Das
      // Blatt bleibt dann offen, damit die Wahl nicht verloren geht.
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}
