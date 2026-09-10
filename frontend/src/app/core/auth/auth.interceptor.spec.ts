import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerAttrappe, authAnbieter, oidcNutzer } from '../../testing/auth-attrappe';
import { ANMELDUNG_NOETIG, type ProblemDetail } from '../api/problem';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

interface Aufbau {
  http: HttpClient;
  kontrolle: HttpTestingController;
  auth: AuthService;
  manager: ManagerAttrappe;
}

function aufbauen(): Aufbau {
  TestBed.resetTestingModule();
  const manager = new ManagerAttrappe();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      ...authAnbieter(manager),
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    kontrolle: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
    manager,
  };
}

/** Lässt die Mikroaufgaben der stillen Erneuerung durchlaufen. */
function durchlauf(): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, 0));
}

/** Bringt den Dienst in den Zustand „angemeldet“, ohne durch das SSO zu gehen. */
async function angemeldet(aufbau: Aufbau, token = 'token-eins'): Promise<void> {
  aufbau.manager.still = oidcNutzer({ token });
  await aufbau.auth.stilleErneuerung();
}

describe('authInterceptor', () => {
  it('hängt das Token an eine Anfrage der eigenen API', async () => {
    const aufbau = aufbauen();
    await angemeldet(aufbau);

    aufbau.http.get('/api/ich').subscribe();

    const anfrage = aufbau.kontrolle.expectOne('/api/ich');
    expect(anfrage.request.headers.get('Authorization')).toBe('Bearer token-eins');
    anfrage.flush({});
  });

  it('lässt eine Anfrage ohne Anmeldung unberührt', () => {
    const aufbau = aufbauen();

    aufbau.http.get('/api/arten').subscribe();

    const anfrage = aufbau.kontrolle.expectOne('/api/arten');
    expect(anfrage.request.headers.has('Authorization')).toBe(false);
    anfrage.flush([]);
  });

  it('gibt das Token nur an die eigene API', async () => {
    const aufbau = aufbauen();
    await angemeldet(aufbau);

    for (const url of [
      '/assets/karte.json',
      'https://sso.beimgraben.net/application/o/pilze/',
      'https://pilze.beimgraben.net/api/funde',
    ]) {
      aufbau.http.get(url).subscribe();
      const anfrage = aufbau.kontrolle.expectOne(url);
      expect(anfrage.request.headers.has('Authorization')).toBe(false);
      anfrage.flush({});
    }
  });

  it('erneuert nach einer 401 still und wiederholt die Anfrage', async () => {
    const aufbau = aufbauen();
    await angemeldet(aufbau, 'token-alt');
    aufbau.manager.still = oidcNutzer({ token: 'token-neu' });
    let gelesen: unknown = null;

    aufbau.http.get('/api/ich').subscribe((wert) => (gelesen = wert));

    aufbau.kontrolle
      .expectOne('/api/ich')
      .flush({ title: 'Nicht angemeldet' }, { status: 401, statusText: 'Unauthorized' });
    await durchlauf();
    const zweite = aufbau.kontrolle.expectOne('/api/ich');
    expect(zweite.request.headers.get('Authorization')).toBe('Bearer token-neu');
    zweite.flush({ sub: 'sub-eins' });

    expect(gelesen).toEqual({ sub: 'sub-eins' });
  });

  it('öffnet das Anmelde-Blatt, wenn die Erneuerung scheitert', async () => {
    const aufbau = aufbauen();
    await angemeldet(aufbau);
    aufbau.manager.still = new Error('keine Sitzung');
    let problem: ProblemDetail | null = null;

    aufbau.http.get('/api/funde').subscribe({ error: (fehler: ProblemDetail) => (problem = fehler) });
    aufbau.kontrolle.expectOne('/api/funde').flush(null, { status: 401, statusText: 'Unauthorized' });
    await durchlauf();

    expect(problem).toMatchObject({ status: 401, code: ANMELDUNG_NOETIG });
    expect(aufbau.auth.blattOffen()).toBe(true);
    aufbau.kontrolle.verify();
  });

  it('reicht jeden anderen Fehler unverändert weiter', () => {
    const aufbau = aufbauen();
    let status = 0;

    aufbau.http
      .get('/api/funde')
      .subscribe({ error: (fehler: { status: number }) => (status = fehler.status) });
    aufbau.kontrolle.expectOne('/api/funde').flush(null, { status: 500, statusText: 'Serverfehler' });

    expect(status).toBe(500);
  });
});
