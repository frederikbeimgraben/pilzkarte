import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import { catchError, throwError, type Observable } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { API_BASE_URL } from './api.config';
import { SIGN_IN_REQUIRED, isProblemDetail, type ProblemDetail } from './problem';

/** Abfragewerte einer URL. `undefined` fällt weg, statt als Text zu landen. */
export type Query = Record<string, string | number | boolean | undefined>;

/**
 * Der einzige Weg zur eigenen API. Jeder Fehler wird zu einem
 * {@link ProblemDetail}, als Toast gezeigt und weitergereicht, damit der
 * Aufrufer selbst entscheiden kann.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly basis = inject(API_BASE_URL);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18nService);

  get<T>(path: string, query?: Query): Observable<T> {
    return this.http
      .get<T>(this.url(path), { params: this.params(query) })
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<T>(this.url(path), body ?? {})
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  /**
   * Lädt eine Datei als `multipart/form-data`. Der Kopf `Content-Type` wird
   * nicht gesetzt: nur der Browser kennt die Grenze zwischen den Teilen.
   */
  postFile<T>(path: string, field: string, file: File): Observable<T> {
    const body = new FormData();
    body.append(field, file, file.name);
    return this.http
      .post<T>(this.url(path), body)
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  /**
   * Holt eine Datei. Ein Foto hängt an den Rechten seines Fundes; es geht
   * darum denselben Weg mit Token und nicht über `src` am Bild.
   */
  getBlob(path: string): Observable<Blob> {
    return this.http
      .get(this.url(path), { responseType: 'blob' })
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<T>(this.url(path), body)
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<T>(this.url(path), body)
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  delete<T>(path: string, query?: Query): Observable<T> {
    return this.http
      .delete<T>(this.url(path), { params: this.params(query) })
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  private url(path: string): string {
    return `${this.basis}${path}`;
  }

  private params(query?: Query): HttpParams {
    let params = new HttpParams();
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params = params.set(name, String(value));
    }
    return params;
  }

  private report(failure: unknown): Observable<never> {
    const problem = this.asProblem(failure);
    if (problem.code !== SIGN_IN_REQUIRED) this.toasts.error(problem.detail ?? problem.title);
    return throwError(() => problem);
  }

  /**
   * Auch ein Abbruch ohne Antwort muss ein Problem ergeben, sonst müsste jeder
   * Aufrufer zwei Fehlerformen kennen.
   */
  private asProblem(failure: unknown): ProblemDetail {
    // Der Interceptor wirft schon ein fertiges Problem. Es hier noch einmal zu
    // deuten machte aus einer bekannten 401 einen unbekannten Fehler.
    if (isProblemDetail(failure)) return failure;
    if (failure instanceof HttpErrorResponse) {
      if (isProblemDetail(failure.error)) return failure.error;
      const withoutResponse = failure.status === 0;
      return {
        type: 'about:blank',
        title: this.i18n.translate(withoutResponse ? 'fehler.netz' : 'fehler.unbekannt'),
        status: failure.status,
      };
    }
    return { type: 'about:blank', title: this.i18n.translate('fehler.unbekannt'), status: 0 };
  }
}
