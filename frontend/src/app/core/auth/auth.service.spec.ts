import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { AuthService } from './auth.service';

interface Setup {
  auth: AuthService;
  manager: ManagerDouble;
}

/** Ein frischer Dienst je Aufruf: mehrere Fälle in einem Test brauchen ihn. */
function build(configured = true): Setup {
  TestBed.resetTestingModule();
  const manager = new ManagerDouble();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), ...authProvider(manager, configured ? undefined : null)],
  });
  return { auth: TestBed.inject(AuthService), manager };
}

describe('AuthService', () => {
  afterEach(() => {
    sessionStorage.clear();
    history.replaceState({}, '', '/');
  });

  it('baut den Manager aus der Konfiguration des Backends', async () => {
    const { auth, manager } = build();
    manager.still = oidcUser();

    await auth.silentRenew();

    expect(manager.settings).toMatchObject({
      authority: 'https://sso.beimgraben.net/application/o/pilze/',
      client_id: 'pilze',
      redirect_uri: 'http://localhost:4200/anmeldung',
      silent_redirect_uri: 'http://localhost:4200/anmeldung/still',
      response_type: 'code',
      scope: 'openid email profile offline_access',
      automaticSilentRenew: true,
    });
  });

  it('bleibt ohne Konfiguration stumm, damit die Karte weiterläuft', async () => {
    const { auth, manager } = build(false);

    await auth.signIn('/karte');
    await auth.handleSilentCallback();
    await auth.signOut();

    expect(await auth.silentRenew()).toBeNull();
    expect(await auth.completeSignIn()).toBe('/');
    expect(manager.settings).toBeNull();
    expect(auth.signedIn()).toBe(false);
  });

  it('merkt sich die Route und führt zum SSO', async () => {
    const { auth, manager } = build();

    await auth.signIn('/eintraege');

    expect(manager.redirects).toEqual([{ back: '/eintraege' }]);
    expect(auth.busy()).toBe(true);
  });

  it('bleibt bedienbar, wenn die Umleitung scheitert', async () => {
    const { auth, manager } = build();
    manager.redirectError = new Error('kein Netz');

    await expect(auth.signIn('/karte')).rejects.toThrow('kein Netz');

    expect(auth.busy()).toBe(false);
  });

  it('übernimmt nach dem Callback Person und Token und kehrt zurück', async () => {
    const { auth, manager } = build();
    manager.returnValue = oidcUser({ state: { back: '/arten/steinpilz' } });

    const target = await auth.completeSignIn();

    expect(target).toBe('/arten/steinpilz');
    expect(auth.signedIn()).toBe(true);
    expect(auth.user()).toEqual({
      sub: 'sub-eins',
      name: 'Frederik',
      email: 'frederik@beimgraben.net',
    });
    expect(auth.token()).toBe('token-eins');
    expect(auth.busy()).toBe(false);
  });

  it('führt nach dem Callback nur auf eigene Wege', async () => {
    for (const state of [
      { back: '//fremde.example/weg' },
      { back: 'https://fremde.example' },
      { back: 42 },
      { other: '/karte' },
      'nur Text',
      null,
    ]) {
      const { auth, manager } = build();
      manager.returnValue = oidcUser({ state });

      expect(await auth.completeSignIn()).toBe('/');
    }
  });

  it('reicht einen gescheiterten Callback weiter', async () => {
    const { auth, manager } = build();
    manager.returnValue = new Error('Code schon eingelöst');

    await expect(auth.completeSignIn()).rejects.toThrow('Code schon eingelöst');
    expect(auth.busy()).toBe(false);
  });

  it('meldet den stillen Callback an das Fenster darüber', async () => {
    const { auth, manager } = build();

    await auth.handleSilentCallback();

    expect(manager.silentCallbacks).toBe(1);
  });

  it('teilt sich einen stillen Versuch, statt je Anfrage einen zu öffnen', async () => {
    const { auth, manager } = build();
    manager.still = oidcUser({ token: 'token-neu' });

    const [first, second] = await Promise.all([auth.silentRenew(), auth.silentRenew()]);

    expect([first, second]).toEqual(['token-neu', 'token-neu']);
    expect(manager.silentAttempts).toBe(1);
  });

  it('meldet ab, wenn die stille Erneuerung scheitert', async () => {
    const { auth, manager } = build();
    manager.returnValue = oidcUser();
    await auth.completeSignIn();
    manager.still = new Error('keine Sitzung');

    expect(await auth.silentRenew()).toBeNull();
    expect(auth.signedIn()).toBe(false);
    expect(auth.busy()).toBe(false);
  });

  it('nimmt ein abgelaufenes Token nicht an', async () => {
    const { auth, manager } = build();
    manager.still = oidcUser({ abgelaufen: true });

    expect(await auth.silentRenew()).toBeNull();
    expect(auth.signedIn()).toBe(false);
  });

  it('folgt den Ereignissen des Managers', async () => {
    const { auth, manager } = build();
    manager.still = null;
    await auth.silentRenew();

    manager.emitLoaded(oidcUser({ token: 'token-zwei' }));
    expect(auth.token()).toBe('token-zwei');

    manager.emitUnloaded();
    expect(auth.signedIn()).toBe(false);
  });

  it('nimmt den Namen aus dem Token, sonst was da ist', async () => {
    const cases = [
      { values: { name: undefined, username: 'frederik' }, name: 'frederik' },
      { values: { name: undefined, email: 'post@example.org' }, name: 'post@example.org' },
      { values: { name: undefined, email: undefined }, name: 'sub-eins' },
    ];
    for (const fall of cases) {
      const { auth, manager } = build();
      manager.still = oidcUser(fall.values);

      await auth.silentRenew();

      expect(auth.user()?.name).toBe(fall.name);
    }
  });

  it('lässt die E-Mail leer, wenn das Token keine trägt', async () => {
    const { auth, manager } = build();
    manager.still = oidcUser({ email: undefined });

    await auth.silentRenew();

    expect(auth.user()?.email).toBe('');
  });

  it('holt beim Start eine Sitzung zurück, die beim SSO noch steht', async () => {
    const { auth, manager } = build();
    manager.still = oidcUser();

    await auth.restoreSession();

    expect(auth.signedIn()).toBe(true);
  });

  it('hält sich auf den Callback-Routen heraus', async () => {
    const { auth, manager } = build();
    manager.still = oidcUser();
    history.replaceState({}, '', '/anmeldung/still');

    await auth.restoreSession();

    expect(manager.silentAttempts).toBe(0);
  });

  it('holt nach dem Abmelden nichts zurück', async () => {
    const { auth, manager } = build();
    manager.returnValue = oidcUser();
    await auth.completeSignIn();

    await auth.signOut();
    expect(manager.removed).toBe(1);
    expect(auth.signedIn()).toBe(false);

    manager.still = oidcUser();
    await auth.restoreSession();
    expect(manager.silentAttempts).toBe(0);
  });

  it('vergisst das Abmelden, sobald eine Anmeldung beginnt', async () => {
    const { auth } = build();
    await auth.signOut();

    await auth.signIn('/karte');

    expect(sessionStorage.getItem('pilzkarte.abgemeldet')).toBeNull();
  });

  it('kommt ohne Sitzungsspeicher aus', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const { auth, manager } = build();
    manager.still = oidcUser();

    await auth.signOut();
    await auth.restoreSession();

    expect(manager.silentAttempts).toBe(1);
  });

  describe('anmeldungAnfordern', () => {
    it('lässt eine angemeldete Person sofort durch', async () => {
      const { auth, manager } = build();
      manager.returnValue = oidcUser();
      await auth.completeSignIn();

      expect(await auth.requestSignIn()).toBe(true);
      expect(auth.sheetOpen()).toBe(false);
    });

    it('öffnet das Blatt und antwortet mit „später“', async () => {
      const { auth } = build();

      const ask = auth.requestSignIn();
      expect(auth.sheetOpen()).toBe(true);

      auth.later();

      expect(await ask).toBe(false);
      expect(auth.sheetOpen()).toBe(false);
    });

    it('antwortet allen Wartenden, sobald die Anmeldung steht', async () => {
      const { auth, manager } = build();
      const ask = [auth.requestSignIn(), auth.requestSignIn()];
      manager.returnValue = oidcUser();

      await auth.completeSignIn();

      expect(await Promise.all(ask)).toEqual([true, true]);
      expect(auth.sheetOpen()).toBe(false);
    });
  });
});
