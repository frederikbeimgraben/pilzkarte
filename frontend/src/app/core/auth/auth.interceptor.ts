import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ANMELDUNG_NOETIG, type ProblemDetail } from '../api/problem';
import { AuthService } from './auth.service';

/** Nur die eigene API bekommt das Token. Der Issuer und Kacheln nie. */
function eigeneApi(url: string): boolean {
  const ziel = new URL(url, location.origin);
  return ziel.origin === location.origin && ziel.pathname.startsWith('/api/');
}

function mitToken<T>(anfrage: HttpRequest<T>, token: string): HttpRequest<T> {
  return anfrage.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/** Das Problem, das der ApiClient stumm weiterreicht, weil das Blatt schon fragt. */
const anmeldungNoetig: ProblemDetail = {
  type: 'about:blank',
  title: 'Nicht angemeldet',
  status: 401,
  code: ANMELDUNG_NOETIG,
};

/**
 * Hängt `Authorization: Bearer` an jede Anfrage an die eigene API. Auf eine 401
 * folgt genau ein stiller Erneuerungsversuch und die Wiederholung. Scheitert
 * auch der, fragt das Anmelde-Blatt nach; der Aufrufer bekommt ein Problem, das
 * keinen Toast auslöst.
 */
export const authInterceptor: HttpInterceptorFn = (anfrage, weiter) => {
  if (!eigeneApi(anfrage.url)) return weiter(anfrage);
  const auth = inject(AuthService);
  const token = auth.token();
  return weiter(token === null ? anfrage : mitToken(anfrage, token)).pipe(
    catchError((fehler: unknown) => {
      if (!(fehler instanceof HttpErrorResponse) || fehler.status !== 401) return throwError(() => fehler);
      return from(auth.stilleErneuerung()).pipe(
        switchMap((frisch) => {
          if (frisch !== null) return weiter(mitToken(anfrage, frisch));
          void auth.anmeldungAnfordern();
          return throwError(() => anmeldungNoetig);
        }),
      );
    }),
  );
};
