import { Injectable, computed, signal } from '@angular/core';

/** Der eigene Standort, wie ihn das Gerät meldet. */
export interface OwnLocation {
  lon: number;
  lat: number;
  /** Der Radius in Metern, in dem der Punkt wirklich liegt. */
  accuracy: number;
}

/**
 * Der eigene Standort als Signal.
 *
 * Die Karte zeigt ihn als Punkt mit Genauigkeitskreis und zentriert auf
 * Wunsch darauf. Ohne Freigabe bleibt `allowed` falsch; die Seite blendet den
 * Knopf dann aus statt ihn scheitern zu lassen.
 *
 * Eine abgelehnte Freigabe lässt sich im Browser wieder erteilen. `permissions`
 * meldet das von selbst, darum hört der Dienst auf die Änderung, statt beim
 * nächsten Tipp erneut zu fragen.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly _location = signal<OwnLocation | null>(null);
  private readonly denied = signal(false);
  private watcher: number | null = null;

  readonly location = this._location.asReadonly();
  /**
   * Nur eine abgelehnte Freigabe sperrt. Ein Browser, der noch nicht gefragt
   * hat, bleibt offen: sonst gäbe es keinen Weg, die Freigabe je zu erteilen.
   */
  readonly allowed = computed(() => !this.denied());

  constructor() {
    void this.followPermission();
  }

  /**
   * Beginnt zu folgen. Mehrfaches Anstoßen bleibt ein Beobachter: die Karte
   * ruft es bei jedem Aufbau, und ein zweiter kostete eine zweite Ortung.
   */
  start(): void {
    if (this.watcher !== null || !this.hasGeolocation()) return;
    this.watcher = navigator.geolocation.watchPosition(
      (position) => {
        this.denied.set(false);
        this._location.set({
          lon: position.coords.longitude,
          lat: position.coords.latitude,
          accuracy: position.coords.accuracy,
        });
      },
      (failure) => {
        // Nur eine abgelehnte Freigabe sperrt den Knopf. Kein Signal im Wald
        // ist kein Nein, und der nächste Versuch kann gelingen.
        if (failure.code === failure.PERMISSION_DENIED) this.denied.set(true);
        this._location.set(null);
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }

  stop(): void {
    if (this.watcher === null) return;
    navigator.geolocation.clearWatch(this.watcher);
    this.watcher = null;
  }

  /**
   * Ein altes Gerät kennt die Ortung gar nicht. Der Typ verspricht sie, der
   * Browser hält das Versprechen nicht immer; darum die Prüfung zur Laufzeit.
   */
  private hasGeolocation(): boolean {
    const api = navigator.geolocation as Partial<Geolocation> | undefined;
    return typeof api?.watchPosition === 'function';
  }

  private async followPermission(): Promise<void> {
    try {
      const state = await navigator.permissions.query({ name: 'geolocation' });
      const read = (): void => {
        this.denied.set(state.state === 'denied');
      };
      read();
      state.addEventListener('change', read);
    } catch {
      // Ein Browser ohne diese Abfrage sagt nichts über die Freigabe. Der Knopf
      // bleibt offen; die erste Ortung entscheidet dann.
    }
  }
}
