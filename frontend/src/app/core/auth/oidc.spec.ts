import { TestBed } from '@angular/core/testing';
import { USER_MANAGER_FACTORY } from './oidc';

/** Der WebStorageStateStore stellt jedem Schlüssel `oidc.` voran. */
function oidcSchluessel(cache: Storage): string[] {
  return Object.keys(cache).filter((schluessel) => schluessel.startsWith('oidc.'));
}

describe('USER_MANAGER_FABRIK', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('hält Token nur im Speicher und den PKCE-Wert in der Sitzung', async () => {
    TestBed.resetTestingModule();
    const factory = TestBed.inject(USER_MANAGER_FACTORY);

    const manager = await factory({
      authority: 'https://sso.beimgraben.net/application/o/pilze/',
      client_id: 'pilze',
      redirect_uri: 'http://localhost:4200/anmeldung',
    });

    // Ein Token darf keinen Reload überleben: der Nutzerspeicher liegt im
    // Arbeitsspeicher und schreibt weder in localStorage noch in die Sitzung.
    await manager.settings.userStore.set('nutzer', 'token');
    expect(await manager.settings.userStore.get('nutzer')).toBe('token');
    expect(oidcSchluessel(localStorage)).toEqual([]);
    expect(oidcSchluessel(sessionStorage)).toEqual([]);

    // Der PKCE-Prüfwert muss den Weg zum SSO überstehen. Er steht in der
    // Sitzung des Tabs, nicht in localStorage.
    await manager.settings.stateStore.set('zustand', 'pruefwert');
    expect(oidcSchluessel(sessionStorage)).toEqual(['oidc.zustand']);
    expect(oidcSchluessel(localStorage)).toEqual([]);
  });
});
