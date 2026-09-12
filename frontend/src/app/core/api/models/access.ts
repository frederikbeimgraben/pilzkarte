/**
 * Rollen, Rechte und Personen, so wie `/api/roles`, `/api/permissions` und
 * `/api/people` sie liefern.
 *
 * Der Rechtekatalog steht im Backend im Code. Hier steht er noch einmal, damit
 * die Oberfläche zu jedem Schlüssel eine Beschriftung findet und die
 * Typprüfung einen Tippfehler fängt. Der Server bleibt die Quelle: er
 * entscheidet, welche Rechte es gibt und wer sie trägt.
 */

export const PERMISSIONS = [
  'species.edit',
  'species.create',
  'species.delete',
  'image.upload',
  'image.review',
  'text.edit',
  'role.manage',
  'role.assign',
  'find.review',
  'run.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Die vier Gruppen, unter denen die Rechtematrix ihre Zeilen zeigt. */
export const PERMISSION_AREAS = ['species', 'interface', 'access', 'data'] as const;

export type PermissionArea = (typeof PERMISSION_AREAS)[number];

/** Ein Recht des Katalogs mit seiner Gruppe. */
export interface PermissionEntry {
  key: Permission;
  area: PermissionArea;
}

/** Die Antwort von `/api/me/permissions`. */
export interface MyPermissions {
  permissions: Permission[];
}

/** Eine Rolle, so kurz wie sie neben einer Person steht. */
export interface RoleRef {
  id: string;
  slug: string;
  name: string;
}

export interface Role extends RoleRef {
  description: string | null;
  /** Admin und Nutzer stehen fest: nicht löschbar, nicht umbenennbar. */
  builtIn: boolean;
  permissions: Permission[];
  people: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleInput {
  slug: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

/** Weggelassene Felder bleiben, wie sie sind. */
export interface RolePatch {
  name?: string;
  description?: string | null;
  permissions?: Permission[];
}

/** Ein Konto, das den Dienst schon einmal benutzt hat. */
export interface Person {
  sub: string;
  email: string | null;
  name: string | null;
  /** Nur die ausdrücklich vergebenen Rollen. Nutzer steht in keiner Zuweisung. */
  roles: RoleRef[];
  createdAt: string;
}
