import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import { catchError, throwError, type Observable } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { API_BASE_URL } from './api.config';
import { istProblemDetail, type ProblemDetail } from './problem';

/** Abfragewerte einer URL. `undefined` fällt weg, statt als Text zu landen. */
export type Abfrage = Record<string, string | number | boolean | undefined>;

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

  get<T>(pfad: string, abfrage?: Abfrage): Observable<T> {
    return this.http
      .get<T>(this.url(pfad), { params: this.params(abfrage) })
      .pipe(catchError((fehler: unknown) => this.melde(fehler)));
  }

  post<T>(pfad: string, koerper?: unknown): Observable<T> {
    return this.http
      .post<T>(this.url(pfad), koerper ?? {})
      .pipe(catchError((fehler: unknown) => this.melde(fehler)));
  }

  patch<T>(pfad: string, koerper: unknown): Observable<T> {
    return this.http
      .patch<T>(this.url(pfad), koerper)
      .pipe(catchError((fehler: unknown) => this.melde(fehler)));
  }

  delete<T>(pfad: string): Observable<T> {
    return this.http.delete<T>(this.url(pfad)).pipe(catchError((fehler: unknown) => this.melde(fehler)));
  }

  private url(pfad: string): string {
    return `${this.basis}${pfad}`;
  }

  private params(abfrage?: Abfrage): HttpParams {
    let params = new HttpParams();
    for (const [name, wert] of Object.entries(abfrage ?? {})) {
      if (wert !== undefined) params = params.set(name, String(wert));
    }
    return params;
  }

  private melde(fehler: unknown): Observable<never> {
    const problem = this.alsProblem(fehler);
    this.toasts.error(problem.detail ?? problem.title);
    return throwError(() => problem);
  }

  /**
   * Auch ein Abbruch ohne Antwort muss ein Problem ergeben, sonst müsste jeder
   * Aufrufer zwei Fehlerformen kennen.
   */
  private alsProblem(fehler: unknown): ProblemDetail {
    if (fehler instanceof HttpErrorResponse) {
      if (istProblemDetail(fehler.error)) return fehler.error;
      const ohneAntwort = fehler.status === 0;
      return {
        type: 'about:blank',
        title: this.i18n.translate(ohneAntwort ? 'fehler.netz' : 'fehler.unbekannt'),
        status: fehler.status,
      };
    }
    return { type: 'about:blank', title: this.i18n.translate('fehler.unbekannt'), status: 0 };
  }
}
