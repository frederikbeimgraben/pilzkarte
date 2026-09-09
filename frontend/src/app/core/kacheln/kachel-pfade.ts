/**
 * Wo die fertigen Karten liegen.
 *
 * Das Rendering in `modell/src/pilze/` schreibt je Art einen Ordner mit
 * Wertkacheln und ein Manifest daneben. Die App liest beides direkt vom
 * Webserver, nicht über das Backend. `proxy.conf.json` bildet genau diese
 * Formen auf pilze.beimgraben.net ab, damit der Entwicklungsserver ohne
 * eigenes Rendering auskommt.
 */

/** Ursprung der Kacheln im Betrieb. */
export const KACHEL_URSPRUNG = 'https://pilze.beimgraben.net';

/**
 * Die Arten mit Vorhersage, in der Schreibweise des Renderings
 * (`modell/run_all.sh`). Der Slug ist der Schlüssel für Manifest, Kachelordner
 * und Trainingsfunde.
 */
export const VORHERSAGE_SLUGS = [
  'boletus_edulis',
  'pfifferling',
  'birkenpilz',
  'reizker',
  'hexen_flock',
  'hexen_netz',
  'parasol',
  'nebelkappe',
  'flaschenbovist',
  'schleimruebling',
  'schopftintling',
] as const;

export type VorhersageSlug = (typeof VORHERSAGE_SLUGS)[number];

/** Manifest einer Art: Wochen, Höchstwert, Nachschlagetabelle. */
export function manifestPfad(slug: string): string {
  return `/${slug}.json`;
}

/**
 * Eine Wertkachel. `wochenOrdner` steht so im Manifest der Art
 * (`boletus_edulis_kacheln/2026W07`); die App leitet ihn nicht selbst her,
 * damit ein Umbenennen im Rendering nur das Manifest betrifft.
 */
export function kachelPfad(wochenOrdner: string, z: number, x: number, y: number): string {
  return `/${wochenOrdner}/${z}/${x}/${y}.png`;
}

/** Manifest der Eingabe-Ebenen. Die Kacheln liegen unter `layers_kacheln/`. */
export const EBENEN_MANIFEST = '/layers.json';

/** Trainingsfunde einer Art. Sie werden nie als Punkte angezeigt. */
export function fundePfad(slug: string): string {
  return `/funde/${slug}.json`;
}
