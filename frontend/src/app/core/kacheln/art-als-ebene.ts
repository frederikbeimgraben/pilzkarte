import { ebenenWoche, type Ebene, type Histogramm } from './ebenen';
import type { ArtManifest } from './manifest';

/**
 * Eine Vorhersage-Art als Eingabe-Ebene.
 *
 * Die Kombination lässt jede Quelle als Faktor zu, auch eine Art. Beide tragen
 * dasselbe: eine Skala mit `low` und `high`, Kachelordner je Woche, eine
 * Liste vorhandener Kacheln und ein Histogramm. Statt zwei Wege durch die
 * halbe Anwendung zu führen, wird die Art hier in die Form der Ebene gebracht:
 * `low` ist 0, `high` der Höchstwert der Art, und ohne Einheit liest sich das
 * als Prozent, was eine Fundwahrscheinlichkeit auch ist.
 */
export function ebeneAusArt(manifest: ArtManifest, label: string): Ebene {
  const histogramme = new Map<string, Histogramm>();
  for (const woche of manifest.wochen) {
    if (woche.histogramm) histogramme.set(ebenenWoche(woche.jahr, woche.woche), woche.histogramm);
  }
  return {
    id: manifest.slug,
    label,
    einheit: '',
    fest: false,
    low: 0,
    high: manifest.top,
    kachelPfad: kachelWurzel(manifest),
    zoomVon: manifest.zoomVon,
    zoomBis: manifest.zoomBis,
    vorhanden: manifest.vorhanden,
    wochen: manifest.wochen.map((woche) => ebenenWoche(woche.jahr, woche.woche)),
    histogramm: null,
    histogramme,
  };
}

/**
 * Der Ordner über den Wochen. Er wird aus dem Pfad der ersten Woche gelesen
 * und nicht aus dem Slug gebaut: dann trifft ein Umbenennen im Rendering nur
 * das Manifest.
 */
function kachelWurzel(manifest: ArtManifest): string {
  const erste = manifest.wochen.at(0)?.kachelPfad ?? '';
  const schnitt = erste.lastIndexOf('/');
  return schnitt > 0 ? erste.slice(0, schnitt) : erste;
}
