import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '@stupa-makers/ui-kit';
import { throwError } from 'rxjs';
import { ApiClient } from './api-client';
import { ANMELDUNG_NOETIG, type ProblemDetail } from './problem';

function aufbauen(): { api: ApiClient; http: HttpTestingController; toasts: ToastService } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return {
    api: TestBed.inject(ApiClient),
    http: TestBed.inject(HttpTestingController),
    toasts: TestBed.inject(ToastService),
  };
}

describe('ApiClient', () => {
  it('ruft die eigene API unter /api', () => {
    const { api, http } = aufbauen();
    let gelesen: { version: string } | null = null;

    api.get<{ version: string }>('/config').subscribe((wert) => (gelesen = wert));
    http.expectOne('/api/config').flush({ version: '2026-09-09' });

    expect(gelesen).toEqual({ version: '2026-09-09' });
    http.verify();
  });

  it('hängt nur gesetzte Abfragewerte an', () => {
    const { api, http } = aufbauen();

    api.get('/funde', { art: 'steinpilz', kw: 40, geteilt: true, seite: undefined }).subscribe();

    const anfrage = http.expectOne((r) => r.url === '/api/funde');
    expect(anfrage.request.params.get('art')).toBe('steinpilz');
    expect(anfrage.request.params.get('kw')).toBe('40');
    expect(anfrage.request.params.get('geteilt')).toBe('true');
    expect(anfrage.request.params.has('seite')).toBe(false);
    anfrage.flush([]);
  });

  it('schreibt, ändert und löscht', () => {
    const { api, http } = aufbauen();

    api.post('/funde', { art: 'steinpilz' }).subscribe();
    expect(http.expectOne('/api/funde').request.body).toEqual({ art: 'steinpilz' });

    api.post('/funde').subscribe();
    expect(http.expectOne('/api/funde').request.body).toEqual({});

    api.patch('/funde/1', { anzahl: 3 }).subscribe();
    expect(http.expectOne('/api/funde/1').request.method).toBe('PATCH');

    api.delete('/funde/1').subscribe();
    expect(http.expectOne('/api/funde/1').request.method).toBe('DELETE');
  });

  it('reicht ein problem+json weiter und zeigt es als Toast', () => {
    const { api, http, toasts } = aufbauen();
    const problem: ProblemDetail = {
      type: 'about:blank',
      title: 'Nicht gefunden',
      status: 404,
      detail: 'Der Fund gehört jemand anderem.',
    };
    const gefangen: ProblemDetail[] = [];

    api.get('/funde/1').subscribe({ error: (fehler: ProblemDetail) => gefangen.push(fehler) });
    http.expectOne('/api/funde/1').flush(problem, { status: 404, statusText: 'Not Found' });

    expect(gefangen[0]).toEqual(problem);
    expect(toasts.toasts()[0].message).toBe('Der Fund gehört jemand anderem.');
  });

  it('macht aus einem Abbruch ohne Antwort ein Problem', () => {
    const { api, http, toasts } = aufbauen();
    const gefangen: ProblemDetail[] = [];

    api.get('/config').subscribe({ error: (fehler: ProblemDetail) => gefangen.push(fehler) });
    http.expectOne('/api/config').error(new ProgressEvent('error'), { status: 0 });

    expect(gefangen[0].title).toBe('Keine Verbindung zum Server.');
    expect(toasts.toasts()[0].message).toBe('Keine Verbindung zum Server.');
  });

  it('macht aus einer Antwort ohne problem+json einen allgemeinen Fehler', () => {
    const { api, http } = aufbauen();
    const gefangen: ProblemDetail[] = [];

    api.get('/config').subscribe({ error: (fehler: ProblemDetail) => gefangen.push(fehler) });
    http.expectOne('/api/config').flush('kaputt', { status: 500, statusText: 'Server Error' });

    expect(gefangen[0].title).toBe('Unbekannter Fehler.');
    expect(gefangen[0].status).toBe(500);
  });

  it('schweigt, wenn das Anmelde-Blatt schon fragt', () => {
    const problem: ProblemDetail = {
      type: 'about:blank',
      title: 'Nicht angemeldet',
      status: 401,
      code: ANMELDUNG_NOETIG,
    };
    // So wirft der authInterceptor: kein HttpErrorResponse, sondern ein
    // fertiges Problem. Der Aufrufer soll es sehen, ohne dass ein Toast
    // danebensteht, denn das Anmelde-Blatt fragt schon.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([() => throwError(() => problem)])),
        provideHttpClientTesting(),
      ],
    });
    const api = TestBed.inject(ApiClient);
    const toasts = TestBed.inject(ToastService);
    const gefangen: ProblemDetail[] = [];

    api.get('/funde').subscribe({ error: (fehler: ProblemDetail) => gefangen.push(fehler) });

    expect(gefangen[0]).toEqual(problem);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('fängt auch einen Fehler, der keine HTTP-Antwort ist', () => {
    const { api, http } = aufbauen();
    const gefangen: ProblemDetail[] = [];

    api.get('/config').subscribe({ error: (fehler: ProblemDetail) => gefangen.push(fehler) });
    const anfrage = http.expectOne('/api/config');
    anfrage.event({ type: 0 } as never);
    anfrage.flush('kaputt', { status: 500, statusText: 'Server Error' });

    expect(gefangen[0].title).toBe('Unbekannter Fehler.');
  });
});
