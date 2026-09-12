import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { filter, map, take, type Observable } from 'rxjs';
import { PermissionsService } from '../../core/access/permissions.service';
import type { Permission } from '../../core/api/models';

/**
 * Die Rechte, die überhaupt einen Punkt der Verwaltung freischalten. Wer keins
 * davon trägt, sieht den Bereich nicht.
 */
export const ADMIN_PERMISSIONS: readonly Permission[] = [
  'text.edit',
  'image.review',
  'species.edit',
  'role.manage',
  'role.assign',
];

/**
 * Lässt eine Route der Verwaltung nur mit dem passenden Recht zu; ohne führt
 * sie zurück auf das Konto. `null` steht für den Bereich selbst: dafür genügt
 * irgendein Recht der Verwaltung.
 *
 * Der Wächter blendet aus, er entscheidet nichts. Jede Route des Servers prüft
 * ihr Recht selbst; wer die Adresse von Hand tippt, bekommt dort ein 403.
 */
export function requiresPermission(permission: Permission | null): CanActivateFn {
  return (): Observable<boolean | UrlTree> => {
    const rights = inject(PermissionsService);
    const router = inject(Router);
    // Beim Start läuft die stille Anmeldung noch. Ohne das Warten fiele ein
    // tiefer Link in die Verwaltung immer auf das Konto zurück.
    return toObservable(rights.settled).pipe(
      filter(Boolean),
      take(1),
      map(() => allowed(rights, permission) || router.parseUrl('/konto')),
    );
  };
}

function allowed(rights: PermissionsService, permission: Permission | null): boolean {
  return permission === null ? rights.canAny(ADMIN_PERMISSIONS) : rights.can(permission);
}
