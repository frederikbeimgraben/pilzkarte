import { Injectable, computed, signal } from '@angular/core';

/** Ein Ort auf der Karte, als [Länge, Breite] wie im GeoJSON. */
export type Ort = readonly [number, number];

/**
 * Die Schritte des Eintragens. Fund und Marker gehen denselben Weg: erst der
 * Ort mit dem Fadenkreuz, dann das Formular. Die Zone setzt statt einem Ort
 * ihre Eckpunkte.
 */
export type Schritt =
  'aktionen' | 'fundOrt' | 'fundFormular' | 'markerOrt' | 'markerFormular' | 'zoneZeichnen' | 'zoneFormular';

/** So viele Eckpunkte braucht eine Fläche mindestens. */
export const ECKPUNKTE_MINDESTENS = 3;

/**
 * Der Ablauf hinter dem Plus-Knopf.
 *
 * Er hält nur, wo man gerade steht und was schon eingesammelt ist. Was daraus
 * wird, entscheidet der {@link EintraegeZustand}; so bleibt der Ablauf ohne
 * Netz prüfbar.
 */
@Injectable({ providedIn: 'root' })
export class EintragenZustand {
  private readonly _schritt = signal<Schritt | null>(null);
  private readonly _ort = signal<Ort | null>(null);
  private readonly _ring = signal<readonly Ort[]>([]);

  readonly schritt = this._schritt.asReadonly();
  /** Der Ort unter dem Fadenkreuz, sobald er übernommen ist. */
  readonly ort = this._ort.asReadonly();
  /** Die Eckpunkte der Zone, in der Reihenfolge des Setzens. */
  readonly ring = this._ring.asReadonly();

  readonly laeuft = computed(() => this._schritt() !== null);
  /** Die Karte wird abgedunkelt, sobald sie nichts mehr zu bedienen gibt. */
  readonly dunkel = computed(() => {
    const schritt = this._schritt();
    return schritt !== null && schritt !== 'fundOrt' && schritt !== 'markerOrt' && schritt !== 'zoneZeichnen';
  });
  readonly zeigtFadenkreuz = computed(() => {
    const schritt = this._schritt();
    return schritt === 'fundOrt' || schritt === 'markerOrt' || schritt === 'zoneZeichnen';
  });
  readonly ringGeschlossen = computed(() => this._ring().length >= ECKPUNKTE_MINDESTENS);

  oeffne(): void {
    this._schritt.set('aktionen');
  }

  beginneFund(): void {
    this._ort.set(null);
    this._schritt.set('fundOrt');
  }

  beginneMarker(): void {
    this._ort.set(null);
    this._schritt.set('markerOrt');
  }

  beginneZone(): void {
    this._ring.set([]);
    this._schritt.set('zoneZeichnen');
  }

  /** Übernimmt den Ort unter dem Fadenkreuz und geht ins Formular. */
  uebernimmOrt(ort: Ort): void {
    this._ort.set(ort);
    this._schritt.update((schritt) => (schritt === 'markerOrt' ? 'markerFormular' : 'fundFormular'));
  }

  setzeEckpunkt(ort: Ort): void {
    this._ring.update((alt) => [...alt, ort]);
  }

  entferneLetztenEckpunkt(): void {
    this._ring.update((alt) => alt.slice(0, -1));
  }

  /** Ersetzt den Ring, nachdem Terra Draw die Eckpunkte verschoben hat. */
  setzeRing(ring: readonly Ort[]): void {
    this._ring.set(ring);
  }

  /** Schließt die Fläche ab. Unter drei Eckpunkten gibt es keine. */
  schliesseZone(): boolean {
    if (!this.ringGeschlossen()) return false;
    this._schritt.set('zoneFormular');
    return true;
  }

  /** Zurück vom Formular zum Ort oder zu den Eckpunkten. */
  zurueck(): void {
    this._schritt.update((schritt) => {
      if (schritt === 'fundFormular') return 'fundOrt';
      if (schritt === 'markerFormular') return 'markerOrt';
      if (schritt === 'zoneFormular') return 'zoneZeichnen';
      return null;
    });
  }

  beende(): void {
    this._schritt.set(null);
    this._ort.set(null);
    this._ring.set([]);
  }
}
