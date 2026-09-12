import { ApplicationRef, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  UrlTree,
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import type { Permission } from '../../core/api/models';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { ANY_ROUTE } from '../../testing/routes';
import { requiresPermission } from './admin.guard';

/** Führt den Wächter aus und sagt, wohin er lässt: `true` oder einen Weg. */
async function decide(
  asked: Permission | null,
  held: Permission[],
  signedIn = true,
): Promise<boolean | string> {
  const api = new AccessApiDouble();
  api.mineAnswer = held;
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  TestBed.configureTestingModule({
    providers: [provideRouter(ANY_ROUTE), ...authStubProviders(auth), accessApiProvider(api)],
  });
  const router = TestBed.inject(Router);
  const answer = runInInjectionContext(TestBed.inject(ApplicationRef).injector, () =>
    requiresPermission(asked)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
  const settled = isObservable(answer) ? await firstValueFrom(answer) : await answer;
  return settled instanceof UrlTree ? router.serializeUrl(settled) : settled === true;
}

describe('requiresPermission', () => {
  it('lässt durch, wer das verlangte Recht trägt', async () => {
    await expect(decide('role.manage', ['role.manage'])).resolves.toBe(true);
  });

  it('führt ohne das Recht zurück auf das Konto', async () => {
    await expect(decide('role.manage', ['role.assign'])).resolves.toBe('/konto');
  });

  it('lässt in den Bereich, wer irgendein Recht der Verwaltung trägt', async () => {
    await expect(decide(null, ['text.edit'])).resolves.toBe(true);
  });

  it('lässt niemanden in den Bereich, dessen Recht dort nichts öffnet', async () => {
    await expect(decide(null, ['find.review'])).resolves.toBe('/konto');
  });

  it('führt ohne Anmeldung zurück auf das Konto', async () => {
    await expect(decide(null, [], false)).resolves.toBe('/konto');
  });
});
