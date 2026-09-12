import type { Species, Farbe, Farben, Masse, Spanne } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import type { BadgeVariant } from '@stupa-makers/ui-kit';
import type { Extent } from '../../ui';
import {
  CHANGE_SPEED_TEXT,
  EDIBILITY_COLOUR,
  EDIBILITY_TEXT,
  MONTH_NAMES,
  PROTECTION_BADGE,
  PROTECTION_TEXT,
  UNIT_TEXT,
  YEAR_MARKS,
} from './labels';

/**
 * Die Zeilen einer Art, fertig für die Bausteine aus `ui/`.
 *
 * Sie stehen hier und nicht in der Artseite, weil der Vergleich zweier Arten
 * dieselben Zeilen zeigt. Zweimal gebaut liefen sie auseinander, sobald eine
 * der beiden Seiten etwas anders benennt.
 *
 * Jede Funktion ist rein: sie nimmt die Art und den Übersetzer und gibt eine
 * Ansicht zurück. So lässt sie sich prüfen, ohne eine Seite aufzubauen.
 */

/** Eine Marke, wie das Kit sie zeichnet. */
export interface Marke {
  text: string;
  variant: BadgeVariant;
}

/**
 * Die Maße in der Reihenfolge, in der die Artseite sie nennt. `extent` sagt,
 * welche Strecke gemessen wurde: das Zeichen davor trägt die Bedeutung, weil
 * ein Balken eine Skala zwischen Hut und Spore vortäuschte, die es nicht gibt.
 */
const MEASURE_ROWS: readonly {
  field: keyof Masse;
  schluessel: TranslationKey;
  unter: TranslationKey;
  extent: Extent;
}[] = [
  {
    field: 'hutBreiteCm',
    schluessel: 'art.mass.hut',
    unter: 'art.mass.unter.breite',
    extent: 'hutbreite',
  },
  {
    field: 'fruchtkoerperBreiteCm',
    schluessel: 'art.mass.fruchtkoerperBreite',
    unter: 'art.mass.unter.breite',
    extent: 'hutbreite',
  },
  {
    field: 'fruchtkoerperHoeheCm',
    schluessel: 'art.mass.fruchtkoerperHoehe',
    unter: 'art.mass.unter.hoehe',
    extent: 'stielhoehe',
  },
  {
    field: 'stielLaengeCm',
    schluessel: 'art.mass.stielLaenge',
    unter: 'art.mass.unter.hoehe',
    extent: 'stielhoehe',
  },
  {
    field: 'stielDickeCm',
    schluessel: 'art.mass.stielDicke',
    unter: 'art.mass.unter.dicke',
    extent: 'stieldicke',
  },
  {
    field: 'sporenLaengeUm',
    schluessel: 'art.mass.sporenLaenge',
    unter: 'art.mass.unter.laenge',
    extent: 'sporenlaenge',
  },
  {
    field: 'sporenBreiteUm',
    schluessel: 'art.mass.sporenBreite',
    unter: 'art.mass.unter.breite',
    extent: 'sporenlaenge',
  },
];

/** Die Farbzeilen der Artseite, in der Reihenfolge des Mockups. */
const COLOUR_ROWS: readonly { field: keyof Omit<Farben, 'verfaerbung'>; schluessel: TranslationKey }[] = [
  { field: 'hut', schluessel: 'art.farbe.hut' },
  { field: 'sporenlager', schluessel: 'art.farbe.sporenlager' },
  { field: 'stiel', schluessel: 'art.farbe.stiel' },
  { field: 'fleisch', schluessel: 'art.farbe.fleisch' },
  { field: 'sporenpulver', schluessel: 'art.farbe.sporenpulver' },
];

/** Eine Zeile der Einstufung: Speisewert als Stufe, Schutz und Handel als Marke. */
export interface LevelRow {
  schluessel: string;
  pill: { text: string; colour: string } | null;
  badge: Marke | null;
}

/** Eine Zeile der Maße: Zeichen, Zahl, Einheit. */
export interface MeasureRow {
  schluessel: string;
  unter: string | null;
  extent: Extent;
  von: number;
  bis: number;
  einheit: string;
  zeichen: string;
}

/** Eine Zeile der Farbtafel: das Wort links, die Fläche rechts. */
export interface ColourRow {
  schluessel: string;
  unter: string;
  farben: Farbe[];
  label: string;
}

/** Die Verfärbung: von, Pfeil, nach, Dauer. */
export interface ChangeRow {
  von: Farbe[];
  nach: Farbe[];
  vonLabel: string;
  nachLabel: string;
  dauer: string;
  pfeil: string;
}

/** Die Jahresbahn mit ihrem Satz darüber. */
export interface TimeRow {
  text: string;
  label: string;
  von: number;
  bis: number;
  beobachtetVon: number | null;
  beobachtetBis: number | null;
  marken: string[];
}

/** Geruch oder Geschmack: Kategorien und der Satz daneben. */
export interface SenseRow {
  schluessel: string;
  tags: string[];
  text: string | null;
  label: string;
}

export function levelRows(i18n: I18nService, art: Species): LevelRow[] {
  const trade = art.marktfaehigkeit.marktfaehig ? 'art.handel.ja' : 'art.handel.nein';
  return [
    {
      schluessel: i18n.translate('art.zeile.speisewert'),
      pill: {
        text: i18n.translate(EDIBILITY_TEXT[art.speisewert]),
        colour: EDIBILITY_COLOUR[art.speisewert],
      },
      badge: null,
    },
    {
      schluessel: i18n.translate('art.zeile.schutz'),
      pill: null,
      badge: {
        text: i18n.translate(PROTECTION_TEXT[art.schutz.status]),
        variant: PROTECTION_BADGE[art.schutz.status],
      },
    },
    {
      schluessel: i18n.translate('art.zeile.handel'),
      pill: null,
      badge: { text: i18n.translate(trade), variant: 'neutral' },
    },
  ];
}

/**
 * Die Maße, jedes mit dem Zeichen seiner Strecke.
 *
 * Die Unterzeile steht nur, wo sie gebraucht wird: bei „Stiel“ zweimal, um
 * Höhe von Dicke zu trennen, und überall dort, wo die Quelle einen selteneren
 * Wert nennt.
 */
export function measureRows(i18n: I18nService, masse: Masse): MeasureRow[] {
  const present = MEASURE_ROWS.flatMap((row) => {
    const span = masse[row.field];
    return span === null ? [] : [{ ...row, span }];
  });
  const names = present.map((row) => i18n.translate(row.schluessel));
  return present.map((row, index) => {
    const span = row.span;
    const unit = i18n.translate(UNIT_TEXT[span.einheit]);
    // Erst wenn zwei Zeilen gleich heißen, sagt die Unterzeile, welche
    // Strecke gemeint ist. Bei einem einzelnen „Hut“ wäre sie Beiwerk.
    const twice = names.filter((name) => name === names[index]).length > 1;
    const notes = [twice ? i18n.translate(row.unter) : null, rareNote(i18n, span, unit)].filter(
      (note): note is string => note !== null,
    );
    return {
      schluessel: names[index],
      unter: notes.length > 0 ? notes.join(' · ') : null,
      extent: row.extent,
      von: span.von,
      bis: span.bis,
      einheit: unit,
      zeichen: i18n.translate(`art.mass.zeichen.${row.extent}`),
    };
  });
}

/** Der Ausreißer der Quelle steht als Wort, nicht als zweite Zahl im Wert. */
function rareNote(i18n: I18nService, span: Spanne, unit: string): string | null {
  if (span.seltenBis !== null) {
    return i18n.translate('art.mass.seltenBis', { wert: span.seltenBis, einheit: unit });
  }
  if (span.seltenVon !== null) {
    return i18n.translate('art.mass.seltenVon', { wert: span.seltenVon, einheit: unit });
  }
  return null;
}

/** Die Farben je Körperteil. Ein Körperteil ohne Farbe steht nicht da. */
export function colourRows(i18n: I18nService, farben: Farben): ColourRow[] {
  return COLOUR_ROWS.flatMap((row) => {
    const colours = farben[row.field];
    if (colours.length === 0) return [];
    const names = colours.map((colour) => colour.name).join(', ');
    return [
      {
        schluessel: i18n.translate(row.schluessel),
        unter: names,
        farben: colours,
        label: i18n.translate('art.farbe.beschriftung', { farben: names }),
      },
    ];
  });
}

/** Ohne Zielfarbe gibt es keine Verfärbung, nur eine Farbe, die bleibt. */
export function changeRow(i18n: I18nService, farben: Farben): ChangeRow | null {
  const change = farben.verfaerbung;
  if (change === null) return null;
  const names = (colours: Farbe[]): string => colours.map((colour) => colour.name).join(', ');
  const label = (colours: Farbe[]): string =>
    i18n.translate('art.farbe.beschriftung', { farben: names(colours) });
  const speed = change.dauer === null ? 'art.verfaerbung.bleibt' : CHANGE_SPEED_TEXT[change.dauer];
  return {
    von: change.von,
    nach: change.nach,
    vonLabel: label(change.von),
    nachLabel: label(change.nach),
    dauer: i18n.translate(change.nach.length === 0 ? 'art.verfaerbung.bleibt' : speed),
    pfeil: i18n.translate('art.verfaerbung.pfeil'),
  };
}

/**
 * Die Jahresbahn: blass der Zeitraum der Quelle, kräftig die Monate, in denen
 * die Kurve mindestens halb so hoch steht wie im Jahresbesten.
 */
export function timeRow(i18n: I18nService, art: Species): TimeRow | null {
  const period = art.zeitraum;
  if (period === null) return null;
  const observed = art.beobachteterZeitraum;
  const month = (number: number): string => i18n.translate(MONTH_NAMES[number - 1]);
  const words = {
    von: month(period.vonMonat),
    bis: month(period.bisMonat),
    vonBeobachtet: observed ? month(observed.vonMonat) : '',
    bisBeobachtet: observed ? month(observed.bisMonat) : '',
  };
  return {
    text: i18n.translate(observed ? 'art.zeit.beobachtet' : 'art.zeit.genannt', words),
    label: i18n.translate(observed ? 'art.zeit.bahnBeobachtet' : 'art.zeit.bahn', words),
    von: period.vonMonat,
    bis: period.bisMonat,
    beobachtetVon: observed?.vonMonat ?? null,
    beobachtetBis: observed?.bisMonat ?? null,
    marken: YEAR_MARKS.map((mark) => i18n.translate(mark)),
  };
}

/** Geruch und Geschmack: die Kategorien tragen den Filter, der Satz den Rest. */
export function senseRows(i18n: I18nService, art: Species): SenseRow[] {
  return [
    { schluessel: 'art.zeile.geruch', sense: art.geruch },
    { schluessel: 'art.zeile.geschmack', sense: art.geschmack },
  ]
    .filter((row) => row.sense.tags.length > 0 || row.sense.text !== null)
    .map((row) => ({
      schluessel: i18n.translate(row.schluessel as TranslationKey),
      tags: row.sense.tags,
      text: row.sense.text,
      label: i18n.translate(row.schluessel as TranslationKey),
    }));
}
