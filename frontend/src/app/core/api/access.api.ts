import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { MyPermissions, Page, PermissionEntry, Person, Role, RoleInput, RolePatch } from './models';

/**
 * Die Endpunkte der Rechteverwaltung. Bis auf die eigenen Rechte verlangt jeder
 * ein Recht; ohne antwortet der Dienst mit 403.
 */
@Injectable({ providedIn: 'root' })
export class AccessApi {
  private readonly api = inject(ApiClient);

  /** Die eigenen Rechte. Braucht nur eine Anmeldung. */
  mine(): Observable<MyPermissions> {
    return this.api.get<MyPermissions>('/me/permissions');
  }

  catalogue(): Observable<PermissionEntry[]> {
    return this.api.get<PermissionEntry[]>('/permissions');
  }

  roles(): Observable<Role[]> {
    return this.api.get<Role[]>('/roles');
  }

  createRole(role: RoleInput): Observable<Role> {
    return this.api.post<Role>('/roles', role);
  }

  patchRole(id: string, patch: RolePatch): Observable<Role> {
    return this.api.patch<Role>(`/roles/${encodeURIComponent(id)}`, patch);
  }

  deleteRole(id: string): Observable<null> {
    return this.api.delete<null>(`/roles/${encodeURIComponent(id)}`);
  }

  people(search: string): Observable<Page<Person>> {
    return this.api.get<Page<Person>>('/people', { q: search || undefined });
  }

  /** Setzt die Rollen einer Person neu. Die Liste ersetzt, sie ergänzt nicht. */
  setRoles(sub: string, roles: string[]): Observable<Person> {
    return this.api.put<Person>(`/people/${encodeURIComponent(sub)}/roles`, { roles });
  }
}
