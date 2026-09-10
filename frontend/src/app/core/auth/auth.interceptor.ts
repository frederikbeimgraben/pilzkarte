import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { SIGN_IN_REQUIRED, type ProblemDetail } from '../api/problem';
import { AuthService } from './auth.service';

/** Nur die eigene API bekommt das Token. Der Issuer und Kacheln nie. */
function ownApi(url: string): boolean {
  const target = new URL(url, location.origin);
  return target.origin === location.origin && target.pathname.startsWith('/api/');
}

function withToken<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/** Das Problem, das der ApiClient stumm weiterreicht, weil das Blatt schon fragt. */
const signInRequired: ProblemDetail = {
  type: 'about:blank',
  title: 'Nicht angemeldet',
  status: 401,
  code: SIGN_IN_REQUIRED,
};

/**
 * Hängt `Authorization: Bearer` an jede Anfrage an die eigene API. Auf eine 401
 * folgt genau ein stiller Erneuerungsversuch und die Wiederholung. Scheitert
 * auch der, fragt das Anmelde-Blatt nach; der Aufrufer bekommt ein Problem, das
 * keinen Toast auslöst.
 */
export const authInterceptor: HttpInterceptorFn = (request, more) => {
  if (!ownApi(request.url)) return more(request);
  const auth = inject(AuthService);
  const token = auth.token();
  return more(token === null ? request : withToken(request, token)).pipe(
    catchError((failure: unknown) => {
      if (!(failure instanceof HttpErrorResponse) || failure.status !== 401) return throwError(() => failure);
      return from(auth.silentRenew()).pipe(
        switchMap((fresh) => {
          if (fresh !== null) return more(withToken(request, fresh));
          void auth.requestSignIn();
          return throwError(() => signInRequired);
        }),
      );
    }),
  );
};
