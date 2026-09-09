import { Injectable } from '@angular/core';
import { leseManifest, type ArtManifest } from './manifest';
import { manifestPfad } from './kachel-pfade';

/**
 * Holt die Manifeste der Arten. Sie liegen als Dateien neben den Kacheln, nicht
 * hinter der API, darum `fetch` statt des `ApiClient`.
 */
@Injectable({ providedIn: 'root' })
export class ManifestDienst {
  // Ein Manifest ändert sich nur beim wöchentlichen Rendering. Innerhalb einer
  // Sitzung wird es darum genau einmal geholt, auch bei parallelen Aufrufen.
  private readonly offen = new Map<string, Promise<ArtManifest>>();

  hole(slug: string): Promise<ArtManifest> {
    let lauf = this.offen.get(slug);
    if (!lauf) {
      lauf = this.laden(slug);
      this.offen.set(slug, lauf);
    }
    return lauf;
  }

  private async laden(slug: string): Promise<ArtManifest> {
    const antwort = await fetch(manifestPfad(slug));
    if (!antwort.ok) {
      this.offen.delete(slug);
      throw new Error(`Manifest ${slug}: ${String(antwort.status)}`);
    }
    return leseManifest(await antwort.json(), slug);
  }
}
