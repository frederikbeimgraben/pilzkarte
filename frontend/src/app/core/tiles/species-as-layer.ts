import { layerWeek, type Layer, type Histogram } from './layers';
import type { SpeciesManifest } from './manifest';

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
export function layerFromSpecies(manifest: SpeciesManifest, label: string): Layer {
  const histogramme = new Map<string, Histogram>();
  for (const woche of manifest.wochen) {
    if (woche.histogramm) histogramme.set(layerWeek(woche.jahr, woche.woche), woche.histogramm);
  }
  return {
    id: manifest.slug,
    label,
    unit: '',
    fixed: false,
    low: 0,
    high: manifest.top,
    tilePath: tileRoot(manifest),
    zoomVon: manifest.zoomVon,
    zoomBis: manifest.zoomBis,
    existing: manifest.existing,
    wochen: manifest.wochen.map((woche) => layerWeek(woche.jahr, woche.woche)),
    histogramm: null,
    histogramme,
  };
}

/**
 * Der Ordner über den Wochen. Er wird aus dem Pfad der ersten Woche gelesen
 * und nicht aus dem Slug gebaut: dann trifft ein Umbenennen im Rendering nur
 * das Manifest.
 */
function tileRoot(manifest: SpeciesManifest): string {
  const first = manifest.wochen.at(0)?.tilePath ?? '';
  const schnitt = first.lastIndexOf('/');
  return schnitt > 0 ? first.slice(0, schnitt) : first;
}
