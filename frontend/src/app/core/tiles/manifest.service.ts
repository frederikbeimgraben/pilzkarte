import { Injectable } from '@angular/core';
import { readManifest, type SpeciesManifest } from './manifest';
import { manifestPath } from './tile-paths';

/**
 * Holt die Manifeste der Arten. Sie liegen als Dateien neben den Kacheln, nicht
 * hinter der API, darum `fetch` statt des `ApiClient`.
 */
@Injectable({ providedIn: 'root' })
export class ManifestService {
  // Ein Manifest ändert sich nur beim wöchentlichen Rendering. Innerhalb einer
  // Sitzung wird es darum genau einmal geholt, auch bei parallelen Aufrufen.
  private readonly pending = new Map<string, Promise<SpeciesManifest>>();

  /** Vergisst, was geholt wurde. Der nächste Aufruf fragt den Server erneut. */
  vergiss(): void {
    this.pending.clear();
  }

  get(slug: string): Promise<SpeciesManifest> {
    let run = this.pending.get(slug);
    if (!run) {
      run = this.load(slug);
      this.pending.set(slug, run);
    }
    return run;
  }

  private async load(slug: string): Promise<SpeciesManifest> {
    const reply = await fetch(manifestPath(slug));
    if (!reply.ok) {
      this.pending.delete(slug);
      throw new Error(`Manifest ${slug}: ${String(reply.status)}`);
    }
    return readManifest(await reply.json(), slug);
  }
}
