import { Injectable, signal } from '@angular/core';

/** Ab dieser Breite steht das Blatt als Spalte neben der Karte (Artboard `Desktop`). */
export const SPALTE_AB = 1024;

/**
 * Ob das Fenster breit genug für die Spaltenansicht ist. Als Signal, damit
 * Blatt und Karte demselben Wert folgen und nicht jede Seite selbst misst.
 */
@Injectable({ providedIn: 'root' })
export class AnsichtDienst {
  private readonly medium = matchMedia(`(min-width: ${String(SPALTE_AB)}px)`);
  private readonly _breit = signal(this.medium.matches);

  readonly breit = this._breit.asReadonly();

  constructor() {
    this.medium.addEventListener('change', (ereignis) => {
      this._breit.set(ereignis.matches);
    });
  }
}
