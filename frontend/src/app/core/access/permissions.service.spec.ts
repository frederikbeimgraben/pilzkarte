import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { PermissionsService } from './permissions.service';

interface Setup {
  rights: PermissionsService;
  auth: AuthStub;
  api: AccessApiDouble;
  tick: () => void;
}

function build(signedIn = true): Setup {
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const api = new AccessApiDouble();
  TestBed.configureTestingModule({ providers: [...authStubProviders(auth), accessApiProvider(api)] });
  const rights = TestBed.inject(PermissionsService);
  const tick = (): void => {
    TestBed.inject(ApplicationRef).tick();
  };
  tick();
  return { rights, auth, api, tick };
}

describe('PermissionsService', () => {
  it('holt die eigenen Rechte, sobald jemand angemeldet ist', () => {
    const { rights, api } = build();

    expect(api.mineCalls).toBe(1);
    expect(rights.can('role.manage')).toBe(true);
    expect(rights.canAny(['role.assign'])).toBe(true);
    expect(rights.settled()).toBe(true);
  });

  it('fragt ohne Anmeldung nicht und trägt kein Recht', () => {
    const { rights, api } = build(false);

    expect(api.mineCalls).toBe(0);
    expect(rights.permissions()).toBeNull();
    expect(rights.can('role.manage')).toBe(false);
    // Wer nicht angemeldet ist und auf nichts wartet, hat seine Antwort.
    expect(rights.settled()).toBe(true);
  });

  it('wartet, solange die stille Anmeldung läuft', () => {
    const { rights, auth, tick } = build(false);
    auth.busy.set(true);
    tick();

    expect(rights.settled()).toBe(false);
  });

  it('räumt die Rechte beim Abmelden weg', () => {
    const { rights, auth, tick } = build();
    auth.user.set(null);
    tick();

    expect(rights.permissions()).toBeNull();
    expect(rights.can('text.edit')).toBe(false);
  });

  it('trägt nach einem Ausfall kein Recht, statt einen Knopf zu zeigen', () => {
    const auth = new AuthStub();
    const api = new AccessApiDouble();
    api.mineFails = true;
    TestBed.configureTestingModule({ providers: [...authStubProviders(auth), accessApiProvider(api)] });
    const rights = TestBed.inject(PermissionsService);
    TestBed.inject(ApplicationRef).tick();

    expect(rights.can('role.manage')).toBe(false);
    // Die Antwort steht fest: leer. Sonst wartete der Wächter für immer.
    expect(rights.settled()).toBe(true);
  });
});
