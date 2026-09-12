import type { Species } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  changeRow,
  colourRows,
  levelRows,
  measureRows,
  senseRows,
  timeRow,
  type ChangeRow,
  type ColourRow,
  type LevelRow,
  type MeasureRow,
  type SenseRow,
  type TimeRow,
} from './feature-rows';

/**
 * Ein Wert in einer Zelle der Gegenüberstellung.
 *
 * Jede Form nennt den Baustein, der sie zeichnet. Eine Zelle trägt eine Liste
 * davon, nicht einen einzelnen Wert: die Hutform wird zwei tragen, jung und
 * alt, und eine Zelle, die nur einen kennt, müsste dafür aufgetrennt werden.
 */
export type ComparisonValue =
  | { kind: 'stufe'; pill: LevelRow['pill'] }
  | { kind: 'mass'; measure: MeasureRow }
  | { kind: 'farbe'; colour: ColourRow }
  | { kind: 'wandel'; change: ChangeRow }
  | { kind: 'tags'; sense: SenseRow }
  | { kind: 'zeit'; time: TimeRow }
  | { kind: 'text'; text: string };

/** Eine Zeile: die Beschriftung und je Art eine Zelle mit ihren Werten. */
export interface ComparisonRow {
  key: string;
  label: string;
  /** Unterscheiden sich die Arten? Dann ist die Zeile getönt. */
  differs: boolean;
  cells: readonly (readonly ComparisonValue[])[];
}

/**
 * Was eine Zeile je Art liefert: die Werte und ein Kennzeichen, an dem sich
 * zwei Arten vergleichen lassen.
 *
 * Verglichen wird das Kennzeichen, nicht die Ansicht. Zwei Arten können
 * dieselbe Farbe anders benannt bekommen, und ein Unterschied im Wortlaut wäre
 * keiner in der Sache.
 */
interface Extract {
  values: readonly ComparisonValue[];
  mark: string;
}

/** Eine Zeile ohne Wert bleibt leer und zählt als gleich, wenn sie überall fehlt. */
const NOTHING: Extract = { values: [], mark: '' };

function level(i18n: I18nService, art: Species): Extract {
  const row = levelRows(i18n, art)[0];
  return { values: [{ kind: 'stufe', pill: row.pill }], mark: art.speisewert };
}

function capWidth(i18n: I18nService, art: Species): Extract {
  const measure = measureRows(i18n, art.masse).find((row) => row.extent === 'hutbreite');
  if (!measure) return NOTHING;
  return { values: [{ kind: 'mass', measure }], mark: `${measure.von}-${measure.bis}${measure.einheit}` };
}

function colour(i18n: I18nService, art: Species, field: 'hut' | 'sporenlager'): Extract {
  const label = i18n.translate(field === 'hut' ? 'art.farbe.hut' : 'art.farbe.sporenlager');
  const row = colourRows(i18n, art.farben).find((entry) => entry.schluessel === label);
  if (!row) return NOTHING;
  return { values: [{ kind: 'farbe', colour: row }], mark: row.farben.map((one) => one.hex).join(',') };
}

function change(i18n: I18nService, art: Species): Extract {
  const row = changeRow(i18n, art.farben);
  if (row === null) return NOTHING;
  const marks = [...row.von, ...row.nach].map((one) => one.hex).join(',');
  return { values: [{ kind: 'wandel', change: row }], mark: marks };
}

function feature(art: Species, key: 'stiel'): Extract {
  const row = art.merkmale.find((entry) => entry.schluessel === key);
  if (!row) return NOTHING;
  return { values: [{ kind: 'text', text: row.text }], mark: row.text };
}

function flavour(i18n: I18nService, art: Species): Extract {
  const label = i18n.translate('art.zeile.geschmack');
  const row = senseRows(i18n, art).find((entry) => entry.schluessel === label);
  if (!row) return NOTHING;
  return { values: [{ kind: 'tags', sense: row }], mark: [...row.tags].sort().join(',') };
}

function period(i18n: I18nService, art: Species): Extract {
  const row = timeRow(i18n, art);
  if (row === null) return NOTHING;
  return { values: [{ kind: 'zeit', time: row }], mark: `${row.von}-${row.bis}` };
}

/** Die acht Zeilen des Vergleichs, in der Reihenfolge des Artboards. */
const ROWS: readonly {
  key: string;
  label: TranslationKey;
  take: (i18n: I18nService, art: Species) => Extract;
}[] = [
  { key: 'speisewert', label: 'art.zeile.speisewert', take: level },
  { key: 'hutbreite', label: 'art.mass.hut', take: capWidth },
  { key: 'hutfarbe', label: 'art.farbe.hut', take: (i18n, art) => colour(i18n, art, 'hut') },
  {
    key: 'sporenlager',
    label: 'art.farbe.sporenlager',
    take: (i18n, art) => colour(i18n, art, 'sporenlager'),
  },
  { key: 'verfaerbung', label: 'art.verfaerbung.zeile', take: change },
  { key: 'stiel', label: 'art.merkmal.stiel', take: (_i18n, art) => feature(art, 'stiel') },
  { key: 'geschmack', label: 'art.zeile.geschmack', take: flavour },
  { key: 'zeit', label: 'art.zeile.wachstum', take: period },
];

/**
 * Die Gegenüberstellung mehrerer Arten.
 *
 * Eine Zeile, die keine der Arten füllt, fällt weg: eine leere Zeile über die
 * ganze Breite sagt nichts und kostet einen Blick.
 */
export function comparisonRows(i18n: I18nService, species: readonly Species[]): ComparisonRow[] {
  return ROWS.flatMap((row) => {
    const taken = species.map((art) => row.take(i18n, art));
    if (taken.every((entry) => entry.values.length === 0)) return [];
    return [
      {
        key: row.key,
        label: i18n.translate(row.label),
        differs: new Set(taken.map((entry) => entry.mark)).size > 1,
        cells: taken.map((entry) => entry.values),
      },
    ];
  });
}
