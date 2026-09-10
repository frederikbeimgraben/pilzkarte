import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerAttrappe, authAnbieter, oidcNutzer } from '../../testing/auth-attrappe';
import { AuthService } from './auth.service';

interface Aufbau {
  auth: AuthService;
  manager: ManagerAttrappe;
}

/** Ein frischer Dienst je Aufruf: mehrere Fälle in einem Test brauchen ihn. */
function aufbauen(konfiguriert = true): Aufbau {
  TestBed.resetTestingModule();
  const manager = new ManagerAttrappe();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), ...authAnbieter(manager, konfiguriert ? undefined : null)],
  });
  return { auth: TestBed.inject(AuthService), manager };
}

describe('AuthService', () => {
  afterEach(() => {
    sessionStorage.clear();
    history.replaceState({}, '', '/');
  });

  it('baut den Manager aus der Konfiguration des Backends', async () => {
    const { auth, manager } = aufbauen();
    manager.still = oidcNutzer();

    await auth.stilleErneuerung();

    expect(manager.einstellungen).toMatchObject({
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
    const { auth, manager } = aufbauen(false);

    await auth.anmelden('/karte');
    await auth.stillenCallbackVerarbeiten();
    await auth.abmelden();

    expect(await auth.stilleErneuerung()).toBeNull();
    expect(await auth.anmeldungAbschliessen()).toBe('/');
    expect(manager.einstellungen).toBeNull();
    expect(auth.angemeldet()).toBe(false);
  });

  it('merkt sich die Route und führt zum SSO', async () => {
    const { auth, manager } = aufbauen();

    await auth.anmelden('/eintraege');

    expect(manager.umleitungen).toEqual([{ zurueck: '/eintraege' }]);
    expect(auth.laedtSchon()).toBe(true);
  });

  it('bleibt bedienbar, wenn die Umleitung scheitert', async () => {
    const { auth, manager } = aufbauen();
    manager.redirectFehler = new Error('kein Netz');

    await expect(auth.anmelden('/karte')).rejects.toThrow('kein Netz');

    expect(auth.laedtSchon()).toBe(false);
  });

  it('übernimmt nach dem Callback Person und Token und kehrt zurück', async () => {
    const { auth, manager } = aufbauen();
    manager.rueckkehr = oidcNutzer({ zustand: { zurueck: '/arten/steinpilz' } });

    const ziel = await auth.anmeldungAbschliessen();

    expect(ziel).toBe('/arten/steinpilz');
    expect(auth.angemeldet()).toBe(true);
    expect(auth.nutzer()).toEqual({
      sub: 'sub-eins',
      name: 'Frederik',
      email: 'frederik@beimgraben.net',
    });
    expect(auth.token()).toBe('token-eins');
    expect(auth.laedtSchon()).toBe(false);
  });

  it('führt nach dem Callback nur auf eigene Wege', async () => {
    for (const zustand of [
      { zurueck: '//fremde.example/weg' },
      { zurueck: 'https://fremde.example' },
      { zurueck: 42 },
      { anderes: '/karte' },
      'nur Text',
      null,
    ]) {
      const { auth, manager } = aufbauen();
      manager.rueckkehr = oidcNutzer({ zustand });

      expect(await auth.anmeldungAbschliessen()).toBe('/');
    }
  });

  it('reicht einen gescheiterten Callback weiter', async () => {
    const { auth, manager } = aufbauen();
    manager.rueckkehr = new Error('Code schon eingelöst');

    await expect(auth.anmeldungAbschliessen()).rejects.toThrow('Code schon eingelöst');
    expect(auth.laedtSchon()).toBe(false);
  });

  it('meldet den stillen Callback an das Fenster darüber', async () => {
    const { auth, manager } = aufbauen();

    await auth.stillenCallbackVerarbeiten();

    expect(manager.stilleCallbacks).toBe(1);
  });

  it('teilt sich einen stillen Versuch, statt je Anfrage einen zu öffnen', async () => {
    const { auth, manager } = aufbauen();
    manager.still = oidcNutzer({ token: 'token-neu' });

    const [erste, zweite] = await Promise.all([auth.stilleErneuerung(), auth.stilleErneuerung()]);

    expect([erste, zweite]).toEqual(['token-neu', 'token-neu']);
    expect(manager.stilleVersuche).toBe(1);
  });

  it('meldet ab, wenn die stille Erneuerung scheitert', async () => {
    const { auth, manager } = aufbauen();
    manager.rueckkehr = oidcNutzer();
    await auth.anmeldungAbschliessen();
    manager.still = new Error('keine Sitzung');

    expect(await auth.stilleErneuerung()).toBeNull();
    expect(auth.angemeldet()).toBe(false);
    expect(auth.laedtSchon()).toBe(false);
  });

  it('nimmt ein abgelaufenes Token nicht an', async () => {
    const { auth, manager } = aufbauen();
    manager.still = oidcNutzer({ abgelaufen: true });

    expect(await auth.stilleErneuerung()).toBeNull();
    expect(auth.angemeldet()).toBe(false);
  });

  it('folgt den Ereignissen des Managers', async () => {
    const { auth, manager } = aufbauen();
    manager.still = null;
    await auth.stilleErneuerung();

    manager.meldeGeladen(oidcNutzer({ token: 'token-zwei' }));
    expect(auth.token()).toBe('token-zwei');

    manager.meldeEntladen();
    expect(auth.angemeldet()).toBe(false);
  });

  it('nimmt den Namen aus dem Token, sonst was da ist', async () => {
    const faelle = [
      { werte: { name: undefined, nutzername: 'frederik' }, name: 'frederik' },
      { werte: { name: undefined, email: 'post@example.org' }, name: 'post@example.org' },
      { werte: { name: undefined, email: undefined }, name: 'sub-eins' },
    ];
    for (const fall of faelle) {
      const { auth, manager } = aufbauen();
      manager.still = oidcNutzer(fall.werte);

      await auth.stilleErneuerung();

      expect(auth.nutzer()?.name).toBe(fall.name);
    }
  });

  it('lässt die E-Mail leer, wenn das Token keine trägt', async () => {
    const { auth, manager } = aufbauen();
    manager.still = oidcNutzer({ email: undefined });

    await auth.stilleErneuerung();

    expect(auth.nutzer()?.email).toBe('');
  });

  it('holt beim Start eine Sitzung zurück, die beim SSO noch steht', async () => {
    const { auth, manager } = aufbauen();
    manager.still = oidcNutzer();

    await auth.sitzungWiederherstellen();

    expect(auth.angemeldet()).toBe(true);
  });

  it('hält sich auf den Callback-Routen heraus', async () => {
    const { auth, manager } = aufbauen();
    manager.still = oidcNutzer();
    history.replaceState({}, '', '/anmeldung/still');

    await auth.sitzungWiederherstellen();

    expect(manager.stilleVersuche).toBe(0);
  });

  it('holt nach dem Abmelden nichts zurück', async () => {
    const { auth, manager } = aufbauen();
    manager.rueckkehr = oidcNutzer();
    await auth.anmeldungAbschliessen();

    await auth.abmelden();
    expect(manager.entfernt).toBe(1);
    expect(auth.angemeldet()).toBe(false);

    manager.still = oidcNutzer();
    await auth.sitzungWiederherstellen();
    expect(manager.stilleVersuche).toBe(0);
  });

  it('vergisst das Abmelden, sobald eine Anmeldung beginnt', async () => {
    const { auth } = aufbauen();
    await auth.abmelden();

    await auth.anmelden('/karte');

    expect(sessionStorage.getItem('pilzkarte.abgemeldet')).toBeNull();
  });

  it('kommt ohne Sitzungsspeicher aus', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const { auth, manager } = aufbauen();
    manager.still = oidcNutzer();

    await auth.abmelden();
    await auth.sitzungWiederherstellen();

    expect(manager.stilleVersuche).toBe(1);
  });

  describe('anmeldungAnfordern', () => {
    it('lässt eine angemeldete Person sofort durch', async () => {
      const { auth, manager } = aufbauen();
      manager.rueckkehr = oidcNutzer();
      await auth.anmeldungAbschliessen();

      expect(await auth.anmeldungAnfordern()).toBe(true);
      expect(auth.blattOffen()).toBe(false);
    });

    it('öffnet das Blatt und antwortet mit „später“', async () => {
      const { auth } = aufbauen();

      const frage = auth.anmeldungAnfordern();
      expect(auth.blattOffen()).toBe(true);

      auth.spaeter();

      expect(await frage).toBe(false);
      expect(auth.blattOffen()).toBe(false);
    });

    it('antwortet allen Wartenden, sobald die Anmeldung steht', async () => {
      const { auth, manager } = aufbauen();
      const fragen = [auth.anmeldungAnfordern(), auth.anmeldungAnfordern()];
      manager.rueckkehr = oidcNutzer();

      await auth.anmeldungAbschliessen();

      expect(await Promise.all(fragen)).toEqual([true, true]);
      expect(auth.blattOffen()).toBe(false);
    });
  });
});
