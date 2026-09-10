import { Injectable, computed, signal } from '@angular/core';

/** Ein Ort auf der Karte, als [Länge, Breite] wie im GeoJSON. */
export type Location = readonly [number, number];

/**
 * Die Schritte des Eintragens. Fund und Marker gehen denselben Weg: erst der
 * Ort mit dem Fadenkreuz, dann das Formular. Die Zone setzt statt einem Ort
 * ihre Eckpunkte.
 */
export type Step =
  'aktionen' | 'fundOrt' | 'fundFormular' | 'markerOrt' | 'markerFormular' | 'zoneZeichnen' | 'zoneFormular';

/** So viele Eckpunkte braucht eine Fläche mindestens. */
export const CORNERS_MINIMUM = 3;

/**
 * Der Ablauf hinter dem Plus-Knopf.
 *
 * Er hält nur, wo man gerade steht und was schon eingesammelt ist. Was daraus
 * wird, entscheidet der {@link EntriesState}; so bleibt der Ablauf ohne
 * Netz prüfbar.
 */
@Injectable({ providedIn: 'root' })
export class AddEntryState {
  private readonly _step = signal<Step | null>(null);
  private readonly _location = signal<Location | null>(null);
  private readonly _ring = signal<readonly Location[]>([]);

  readonly step = this._step.asReadonly();
  /** Der Ort unter dem Fadenkreuz, sobald er übernommen ist. */
  readonly location = this._location.asReadonly();
  /** Die Eckpunkte der Zone, in der Reihenfolge des Setzens. */
  readonly ring = this._ring.asReadonly();

  readonly running = computed(() => this._step() !== null);
  /** Die Karte wird abgedunkelt, sobald sie nichts mehr zu bedienen gibt. */
  readonly dark = computed(() => {
    const step = this._step();
    return step !== null && step !== 'fundOrt' && step !== 'markerOrt' && step !== 'zoneZeichnen';
  });
  readonly showsCrosshair = computed(() => {
    const step = this._step();
    return step === 'fundOrt' || step === 'markerOrt' || step === 'zoneZeichnen';
  });
  readonly ringClosed = computed(() => this._ring().length >= CORNERS_MINIMUM);

  open(): void {
    this._step.set('aktionen');
  }

  startFind(): void {
    this._location.set(null);
    this._step.set('fundOrt');
  }

  startMarker(): void {
    this._location.set(null);
    this._step.set('markerOrt');
  }

  startZone(): void {
    this._ring.set([]);
    this._step.set('zoneZeichnen');
  }

  /** Übernimmt den Ort unter dem Fadenkreuz und geht ins Formular. */
  adoptLocation(location: Location): void {
    this._location.set(location);
    this._step.update((step) => (step === 'markerOrt' ? 'markerFormular' : 'fundFormular'));
  }

  addCorner(location: Location): void {
    this._ring.update((alt) => [...alt, location]);
  }

  removeLastCorner(): void {
    this._ring.update((alt) => alt.slice(0, -1));
  }

  /** Ersetzt den Ring, nachdem Terra Draw die Eckpunkte verschoben hat. */
  setRing(ring: readonly Location[]): void {
    this._ring.set(ring);
  }

  /** Schließt die Fläche ab. Unter drei Eckpunkten gibt es keine. */
  closeZone(): boolean {
    if (!this.ringClosed()) return false;
    this._step.set('zoneFormular');
    return true;
  }

  /** Zurück vom Formular zum Ort oder zu den Eckpunkten. */
  back(): void {
    this._step.update((step) => {
      if (step === 'fundFormular') return 'fundOrt';
      if (step === 'markerFormular') return 'markerOrt';
      if (step === 'zoneFormular') return 'zoneZeichnen';
      return null;
    });
  }

  stop(): void {
    this._step.set(null);
    this._location.set(null);
    this._ring.set([]);
  }
}
