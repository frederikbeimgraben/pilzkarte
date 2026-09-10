import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { SIGN_IN_REQUIRED, type ProblemDetail } from '../api/problem';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

interface Setup {
  http: HttpClient;
  control: HttpTestingController;
  auth: AuthService;
  manager: ManagerDouble;
}

function build(): Setup {
  TestBed.resetTestingModule();
  const manager = new ManagerDouble();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      ...authProvider(manager),
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    control: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
    manager,
  };
}

/** Lässt die Mikroaufgaben der stillen Erneuerung durchlaufen. */
function pass(): Promise<void> {
  return new Promise((done) => setTimeout(done, 0));
}

/** Bringt den Dienst in den Zustand „angemeldet“, ohne durch das SSO zu gehen. */
async function signedIn(setup: Setup, token = 'token-eins'): Promise<void> {
  setup.manager.still = oidcUser({ token });
  await setup.auth.silentRenew();
}

describe('authInterceptor', () => {
  it('hängt das Token an eine Anfrage der eigenen API', async () => {
    const setup = build();
    await signedIn(setup);

    setup.http.get('/api/ich').subscribe();

    const request = setup.control.expectOne('/api/ich');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-eins');
    request.flush({});
  });

  it('lässt eine Anfrage ohne Anmeldung unberührt', () => {
    const setup = build();

    setup.http.get('/api/arten').subscribe();

    const request = setup.control.expectOne('/api/arten');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('gibt das Token nur an die eigene API', async () => {
    const setup = build();
    await signedIn(setup);

    for (const url of [
      '/assets/karte.json',
      'https://sso.beimgraben.net/application/o/pilze/',
      'https://pilze.beimgraben.net/api/funde',
    ]) {
      setup.http.get(url).subscribe();
      const request = setup.control.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
  });

  it('erneuert nach einer 401 still und wiederholt die Anfrage', async () => {
    const setup = build();
    await signedIn(setup, 'token-alt');
    setup.manager.still = oidcUser({ token: 'token-neu' });
    let got: unknown = null;

    setup.http.get('/api/ich').subscribe((value) => (got = value));

    setup.control
      .expectOne('/api/ich')
      .flush({ title: 'Nicht angemeldet' }, { status: 401, statusText: 'Unauthorized' });
    await pass();
    const second = setup.control.expectOne('/api/ich');
    expect(second.request.headers.get('Authorization')).toBe('Bearer token-neu');
    second.flush({ sub: 'sub-eins' });

    expect(got).toEqual({ sub: 'sub-eins' });
  });

  it('öffnet das Anmelde-Blatt, wenn die Erneuerung scheitert', async () => {
    const setup = build();
    await signedIn(setup);
    setup.manager.still = new Error('keine Sitzung');
    let problem: ProblemDetail | null = null;

    setup.http.get('/api/funde').subscribe({ error: (failure: ProblemDetail) => (problem = failure) });
    setup.control.expectOne('/api/funde').flush(null, { status: 401, statusText: 'Unauthorized' });
    await pass();

    expect(problem).toMatchObject({ status: 401, code: SIGN_IN_REQUIRED });
    expect(setup.auth.sheetOpen()).toBe(true);
    setup.control.verify();
  });

  it('reicht jeden anderen Fehler unverändert weiter', () => {
    const setup = build();
    let status = 0;

    setup.http
      .get('/api/funde')
      .subscribe({ error: (failure: { status: number }) => (status = failure.status) });
    setup.control.expectOne('/api/funde').flush(null, { status: 500, statusText: 'Serverfehler' });

    expect(status).toBe(500);
  });
});
