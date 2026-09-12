import { of, throwError, type Observable } from 'rxjs';
import { AccessApi } from '../core/api/access.api';
import type {
  MyPermissions,
  Page,
  Permission,
  PermissionEntry,
  Person,
  Role,
  RoleInput,
  RolePatch,
} from '../core/api/models';
import type { ProblemDetail } from '../core/api/problem';

const NOW = '2026-09-12T10:00:00+02:00';

/** Der Katalog, so wie `/api/permissions` ihn liefert. */
export const CATALOGUE: PermissionEntry[] = [
  { key: 'species.edit', area: 'species' },
  { key: 'species.create', area: 'species' },
  { key: 'species.delete', area: 'species' },
  { key: 'image.upload', area: 'species' },
  { key: 'image.review', area: 'species' },
  { key: 'text.edit', area: 'interface' },
  { key: 'role.manage', area: 'access' },
  { key: 'role.assign', area: 'access' },
  { key: 'find.review', area: 'data' },
  { key: 'run.manage', area: 'data' },
];

export const EVERY_PERMISSION: Permission[] = CATALOGUE.map((entry) => entry.key);

export function role(part: Partial<Role> & Pick<Role, 'id' | 'slug' | 'name'>): Role {
  return {
    description: null,
    builtIn: false,
    permissions: [],
    people: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...part,
  };
}

export const ADMIN_ROLE = role({
  id: 'rolle-admin',
  slug: 'admin',
  name: 'Admin',
  description: 'Trägt jedes Recht, auch jedes neu eingeführte.',
  builtIn: true,
  permissions: EVERY_PERMISSION,
  people: 1,
});

export const USER_ROLE = role({
  id: 'rolle-nutzer',
  slug: 'user',
  name: 'Nutzer',
  description: 'Hat jede angemeldete Person.',
  builtIn: true,
});

export const ADVISOR_ROLE = role({
  id: 'rolle-berater',
  slug: 'berater',
  name: 'Pilzberater',
  description: 'Arten und Bilder pflegen.',
  permissions: ['species.edit', 'image.review'],
  people: 3,
});

export const ROLES: Role[] = [ADMIN_ROLE, USER_ROLE, ADVISOR_ROLE];

export function person(part: Partial<Person> & Pick<Person, 'sub'>): Person {
  return { email: null, name: null, roles: [], createdAt: NOW, ...part };
}

export const PEOPLE: Person[] = [
  person({
    sub: 'sub-frederik',
    name: 'Frederik',
    email: 'frederik@beimgraben.net',
    roles: [{ id: ADMIN_ROLE.id, slug: ADMIN_ROLE.slug, name: ADMIN_ROLE.name }],
  }),
  person({ sub: 'sub-jonas', name: 'Jonas', email: 'jonas@example.test' }),
];

/** Ein Fehler des Dienstes, so wie der ApiClient ihn weiterreicht. */
export function problem(status: number, detail: string): ProblemDetail {
  return { type: 'about:blank', title: 'Konflikt', status, detail };
}

/**
 * Ein Doppelgänger der Rechte-API. Der Test sagt, was der Dienst antwortet,
 * und liest hinterher nach, was gefragt wurde.
 */
export class AccessApiDouble {
  mineAnswer: Permission[] = EVERY_PERMISSION;
  /** Wahr, wenn der Abruf der eigenen Rechte scheitern soll. */
  mineFails = false;
  roleList: Role[] = ROLES;
  peopleList: Person[] = PEOPLE;
  catalogueList: PermissionEntry[] = CATALOGUE;
  /** Steht hier ein Problem, weist der nächste Schreibzugriff es zurück. */
  rejectWith: ProblemDetail | null = null;

  readonly searches: string[] = [];
  readonly created: RoleInput[] = [];
  readonly patched: { id: string; patch: RolePatch }[] = [];
  readonly deleted: string[] = [];
  readonly assigned: { sub: string; roles: string[] }[] = [];
  mineCalls = 0;

  mine(): Observable<MyPermissions> {
    this.mineCalls += 1;
    if (this.mineFails) return throwError(() => problem(503, 'Der Dienst antwortet nicht.'));
    return of({ permissions: this.mineAnswer });
  }

  catalogue(): Observable<PermissionEntry[]> {
    return of(this.catalogueList);
  }

  roles(): Observable<Role[]> {
    return of(this.roleList);
  }

  createRole(input: RoleInput): Observable<Role> {
    this.created.push(input);
    return this.answer(role({ id: 'rolle-neu', slug: input.slug, name: input.name }));
  }

  patchRole(id: string, patch: RolePatch): Observable<Role> {
    this.patched.push({ id, patch });
    return this.answer(role({ id, slug: 'berater', name: patch.name ?? 'Pilzberater' }));
  }

  deleteRole(id: string): Observable<null> {
    this.deleted.push(id);
    return this.answer(null);
  }

  people(search: string): Observable<Page<Person>> {
    this.searches.push(search);
    const hit = this.peopleList.filter((one) =>
      search === '' ? true : (one.name ?? '').toLowerCase().includes(search.toLowerCase()),
    );
    return of({ eintraege: hit, gesamt: hit.length, limit: 50, offset: 0 });
  }

  setRoles(sub: string, roles: string[]): Observable<Person> {
    this.assigned.push({ sub, roles });
    const known = this.roleList.filter((one) => roles.includes(one.id));
    const before = this.peopleList.find((one) => one.sub === sub);
    return this.answer(
      person({
        ...before,
        sub,
        roles: known.map((one) => ({ id: one.id, slug: one.slug, name: one.name })),
      }),
    );
  }

  private answer<T>(value: T): Observable<T> {
    const failure = this.rejectWith;
    this.rejectWith = null;
    return failure === null ? of(value) : throwError(() => failure);
  }
}

/** Hängt den Doppelgänger an die Stelle der echten API. */
export function accessApiProvider(double: AccessApiDouble): { provide: typeof AccessApi; useValue: unknown } {
  return { provide: AccessApi, useValue: double };
}
