import { Injectable } from '@angular/core';
import { LAYERS_MANIFEST } from './tile-paths';
import { readLayers, type LayersManifest } from './layers';

/**
 * Holt `layers.json`. Es liegt als Datei neben den Kacheln, nicht hinter der
 * API, darum `fetch` statt des `ApiClient`.
 */
@Injectable({ providedIn: 'root' })
export class LayersService {
  // Das Manifest ändert sich nur beim wöchentlichen Rendering. Innerhalb einer
  // Sitzung wird es darum genau einmal geholt, auch bei parallelen Aufrufen.
  private pending: Promise<LayersManifest> | null = null;

  /** Vergisst, was geholt wurde. Der nächste Aufruf fragt den Server erneut. */
  vergiss(): void {
    this.pending = null;
  }

  get(): Promise<LayersManifest> {
    this.pending ??= this.load();
    return this.pending;
  }

  private async load(): Promise<LayersManifest> {
    const reply = await fetch(LAYERS_MANIFEST);
    if (!reply.ok) {
      this.pending = null;
      throw new Error(`Ebenen: ${String(reply.status)}`);
    }
    return readLayers(await reply.json());
  }
}
