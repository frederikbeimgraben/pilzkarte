import { Injectable, signal } from '@angular/core';

/** Ab dieser Breite steht das Blatt als Spalte neben der Karte (Artboard `Desktop`). */
export const COLUMN_FROM = 1024;

/**
 * Ob das Fenster breit genug für die Spaltenansicht ist. Als Signal, damit
 * Blatt und Karte demselben Wert folgen und nicht jede Seite selbst misst.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly medium = matchMedia(`(min-width: ${String(COLUMN_FROM)}px)`);
  private readonly _wide = signal(this.medium.matches);

  readonly wide = this._wide.asReadonly();

  constructor() {
    this.medium.addEventListener('change', (event) => {
      this._wide.set(event.matches);
    });
  }
}
