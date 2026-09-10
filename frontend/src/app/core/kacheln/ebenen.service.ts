import { Injectable } from '@angular/core';
import { EBENEN_MANIFEST } from './kachel-pfade';
import { leseEbenen, type EbenenManifest } from './ebenen';

/**
 * Holt `layers.json`. Es liegt als Datei neben den Kacheln, nicht hinter der
 * API, darum `fetch` statt des `ApiClient`.
 */
@Injectable({ providedIn: 'root' })
export class EbenenDienst {
  // Das Manifest ändert sich nur beim wöchentlichen Rendering. Innerhalb einer
  // Sitzung wird es darum genau einmal geholt, auch bei parallelen Aufrufen.
  private offen: Promise<EbenenManifest> | null = null;

  hole(): Promise<EbenenManifest> {
    this.offen ??= this.laden();
    return this.offen;
  }

  private async laden(): Promise<EbenenManifest> {
    const antwort = await fetch(EBENEN_MANIFEST);
    if (!antwort.ok) {
      this.offen = null;
      throw new Error(`Ebenen: ${String(antwort.status)}`);
    }
    return leseEbenen(await antwort.json());
  }
}
