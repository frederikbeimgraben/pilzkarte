import { Injectable, inject, signal } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { AccessApi } from '../../core/api/access.api';
import type { PermissionEntry, Person, Role, RoleInput, RolePatch } from '../../core/api/models';

/**
 * Rollen, Rechtekatalog und Konten im Speicher.
 *
 * Die Verwaltung besteht aus mehreren Seiten über denselben Daten. Sie liegen
 * darum hier und nicht in einer Seite: sonst lädt jeder Wechsel zwischen
 * Rollenliste und Rolle die Liste neu.
 */
@Injectable({ providedIn: 'root' })
export class AdminState {
  private readonly api = inject(AccessApi);

  private readonly _roles = signal<readonly Role[] | null>(null);
  private readonly _catalogue = signal<readonly PermissionEntry[] | null>(null);
  private readonly _people = signal<readonly Person[] | null>(null);
  private readonly _search = signal('');

  /** `null`, solange die erste Antwort aussteht. */
  readonly roles = this._roles.asReadonly();
  readonly catalogue = this._catalogue.asReadonly();
  readonly people = this._people.asReadonly();
  readonly search = this._search.asReadonly();

  loadRoles(): void {
    this.api.roles().subscribe((roles) => {
      this._roles.set(roles);
    });
  }

  loadCatalogue(): void {
    if (this._catalogue() !== null) return;
    this.api.catalogue().subscribe((entries) => {
      this._catalogue.set(entries);
    });
  }

  /** Sucht in Name und E-Mail. Ein leerer Text liefert alle Konten. */
  loadPeople(search: string): void {
    this._search.set(search);
    this.api.people(search).subscribe((page) => {
      // Eine ältere, langsamere Antwort darf die jüngere Suche nicht ersetzen.
      if (this._search() === search) this._people.set(page.eintraege);
    });
  }

  createRole(input: RoleInput): Observable<Role> {
    return this.api.createRole(input).pipe(
      tap(() => {
        this.loadRoles();
      }),
    );
  }

  patchRole(id: string, patch: RolePatch): Observable<Role> {
    return this.api.patchRole(id, patch).pipe(
      tap(() => {
        this.loadRoles();
      }),
    );
  }

  deleteRole(id: string): Observable<null> {
    return this.api.deleteRole(id).pipe(
      tap(() => {
        this.loadRoles();
      }),
    );
  }

  /** Setzt die Rollen einer Person neu und schreibt die Antwort in die Liste. */
  setRoles(sub: string, roles: readonly string[]): Observable<Person> {
    return this.api.setRoles(sub, [...roles]).pipe(
      tap((person) => {
        this._people.update((all) => all?.map((one) => (one.sub === person.sub ? person : one)) ?? null);
        // Die Zahl der Personen je Rolle steht in der Rollenliste.
        if (this._roles() !== null) this.loadRoles();
      }),
    );
  }
}
