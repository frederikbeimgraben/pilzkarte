import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '@stupa-makers/ui-kit';
import { throwError } from 'rxjs';
import { ApiClient } from './api-client';
import { SIGN_IN_REQUIRED, type ProblemDetail } from './problem';

function build(): { api: ApiClient; http: HttpTestingController; toasts: ToastService } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return {
    api: TestBed.inject(ApiClient),
    http: TestBed.inject(HttpTestingController),
    toasts: TestBed.inject(ToastService),
  };
}

describe('ApiClient', () => {
  it('ruft die eigene API unter /api', () => {
    const { api, http } = build();
    let got: { version: string } | null = null;

    api.get<{ version: string }>('/config').subscribe((value) => (got = value));
    http.expectOne('/api/config').flush({ version: '2026-09-09' });

    expect(got).toEqual({ version: '2026-09-09' });
    http.verify();
  });

  it('hängt nur gesetzte Abfragewerte an', () => {
    const { api, http } = build();

    api.get('/funde', { art: 'steinpilz', kw: 40, geteilt: true, page: undefined }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/funde');
    expect(request.request.params.get('art')).toBe('steinpilz');
    expect(request.request.params.get('kw')).toBe('40');
    expect(request.request.params.get('geteilt')).toBe('true');
    expect(request.request.params.has('seite')).toBe(false);
    request.flush([]);
  });

  it('schreibt, ändert und löscht', () => {
    const { api, http } = build();

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
    const { api, http, toasts } = build();
    const problem: ProblemDetail = {
      type: 'about:blank',
      title: 'Nicht gefunden',
      status: 404,
      detail: 'Der Fund gehört jemand anderem.',
    };
    const caught: ProblemDetail[] = [];

    api.get('/funde/1').subscribe({ error: (failure: ProblemDetail) => caught.push(failure) });
    http.expectOne('/api/funde/1').flush(problem, { status: 404, statusText: 'Not Found' });

    expect(caught[0]).toEqual(problem);
    expect(toasts.toasts()[0].message).toBe('Der Fund gehört jemand anderem.');
  });

  it('macht aus einem Abbruch ohne Antwort ein Problem', () => {
    const { api, http, toasts } = build();
    const caught: ProblemDetail[] = [];

    api.get('/config').subscribe({ error: (failure: ProblemDetail) => caught.push(failure) });
    http.expectOne('/api/config').error(new ProgressEvent('error'), { status: 0 });

    expect(caught[0].title).toBe('Keine Verbindung zum Server.');
    expect(toasts.toasts()[0].message).toBe('Keine Verbindung zum Server.');
  });

  it('macht aus einer Antwort ohne problem+json einen allgemeinen Fehler', () => {
    const { api, http } = build();
    const caught: ProblemDetail[] = [];

    api.get('/config').subscribe({ error: (failure: ProblemDetail) => caught.push(failure) });
    http.expectOne('/api/config').flush('kaputt', { status: 500, statusText: 'Server Error' });

    expect(caught[0].title).toBe('Unbekannter Fehler.');
    expect(caught[0].status).toBe(500);
  });

  it('schweigt, wenn das Anmelde-Blatt schon fragt', () => {
    const problem: ProblemDetail = {
      type: 'about:blank',
      title: 'Nicht angemeldet',
      status: 401,
      code: SIGN_IN_REQUIRED,
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
    const caught: ProblemDetail[] = [];

    api.get('/funde').subscribe({ error: (failure: ProblemDetail) => caught.push(failure) });

    expect(caught[0]).toEqual(problem);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('fängt auch einen Fehler, der keine HTTP-Antwort ist', () => {
    const { api, http } = build();
    const caught: ProblemDetail[] = [];

    api.get('/config').subscribe({ error: (failure: ProblemDetail) => caught.push(failure) });
    const request = http.expectOne('/api/config');
    request.event({ type: 0 } as never);
    request.flush('kaputt', { status: 500, statusText: 'Server Error' });

    expect(caught[0].title).toBe('Unbekannter Fehler.');
  });
});
