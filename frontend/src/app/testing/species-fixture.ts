import type { Species, SpeciesCatalogue, SpeciesBrief, SeasonCurveData } from '../core/api/models';

const WEEKS = 52;

/** Der Schutzstatus, den die meisten Arten tragen. */
const KEIN_SCHUTZ = {
  status: 'keiner',
  quelle: 'Bundesartenschutzverordnung, Anlage 1',
} as const;

/** Eine Glocke über dem Herbst, damit die Kurve etwas zu zeichnen hat. */
function glocke(peak: number, hoehe: number): number[] {
  return Array.from({ length: WEEKS }, (_, i) => Math.max(0, hoehe - Math.abs(i - peak) * 2));
}

const VISITS_ALL_YEARS = Array.from({ length: WEEKS }, (_, i) => (i < 4 ? 5 : 120));
const VISITS_CURRENT_YEAR = Array.from({ length: 36 }, (_, i) => (i > 33 ? 2 : 40));

function brief(
  art: Partial<SpeciesBrief> & Pick<SpeciesBrief, 'slug' | 'name' | 'lateinisch'>,
): SpeciesBrief {
  return {
    gruppe: 'roehrling',
    stufe: 'vorhersage',
    tags: ['vorhersage', 'roehrling', 'sommer', 'herbst', 'fichte'],
    schutz: KEIN_SCHUTZ,
    speisewert: 'essbar',
    kartenSlug: null,
    sammelbar: true,
    marktfaehigkeit: { marktfaehig: true, schweiz: null },
    wertigkeit: 1,
    haeufigkeit: 'haeufig',
    gefaehrdung: null,
    warnung: null,
    jahreszeiten: ['sommer', 'herbst'],
    baeume: ['fichte'],
    baeumeAusErfahrung: null,
    weitereNamen: [],
    synonyme: [],
    vorhersageGeplant: true,
    begehungenMitFund: 1853,
    spitzeWoche: 40,
    saison: { alleJahre: glocke(39, 32), laufendesJahr: glocke(39, 28).slice(0, 36), hoechstwert: 32 },
    ...art,
  };
}

export const PENNY_BUN_BRIEF = brief({
  slug: 'steinpilz',
  name: 'Steinpilz',
  lateinisch: 'Boletus edulis',
  schutz: { status: 'besondersGeschuetzt', quelle: 'Bundesartenschutzverordnung, Anlage 1' },
  kartenSlug: 'boletus_edulis',
  tags: ['vorhersage', 'roehrling', 'sommer', 'herbst', 'fichte', 'buche'],
});

export const BAY_BOLETE_BRIEF = brief({
  slug: 'maronenroehrling',
  name: 'Maronenröhrling',
  lateinisch: 'Imleria badia',
  kartenSlug: 'imleria_badia',
});

export const HEDGEHOG_BRIEF = brief({
  slug: 'semmelstoppelpilz',
  name: 'Semmelstoppelpilz',
  lateinisch: 'Hydnum repandum',
  gruppe: 'stoppelpilz',
  stufe: 'saison',
  tags: ['saison', 'stoppelpilz', 'sommer', 'herbst', 'buche'],
  begehungenMitFund: 180,
});

export const MOREL_BRIEF = brief({
  slug: 'speisemorchel',
  name: 'Speisemorchel',
  lateinisch: 'Morchella esculenta',
  gruppe: 'morchel',
  stufe: 'profil',
  tags: ['profil', 'morchel', 'fruehling', 'esche'],
  begehungenMitFund: 0,
  spitzeWoche: null,
  saison: {
    alleJahre: Array.from({ length: WEEKS }, () => 0),
    laufendesJahr: Array.from({ length: 36 }, () => 0),
    hoechstwert: 0,
  },
});

export const GALLENROEHRLING_KURZ: SpeciesBrief = {
  ...BAY_BOLETE_BRIEF,
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  lateinisch: 'Tylopilus felleus',
  stufe: 'profil',
  tags: ['profil', 'roehrling', 'sommer', 'herbst'],
  speisewert: 'giftig',
  kartenSlug: null,
  sammelbar: false,
  marktfaehigkeit: { marktfaehig: false, schweiz: null },
  wertigkeit: null,
  haeufigkeit: null,
  gefaehrdung: null,
  warnung: null,
  jahreszeiten: ['sommer', 'herbst'],
  baeume: [],
  baeumeAusErfahrung: null,
  vorhersageGeplant: false,
  begehungenMitFund: 0,
  spitzeWoche: null,
  saison: null,
};

export const SPECIES_LIST: SpeciesCatalogue = {
  stand: { jahr: 2025, woche: 39 },
  jahre: { von: 2015, bis: 2024 },
  begehungen: 48_120,
  begehungenJeWocheAlleJahre: VISITS_ALL_YEARS,
  begehungenJeWocheLaufendesJahr: VISITS_CURRENT_YEAR,
  arten: [PENNY_BUN_BRIEF, BAY_BOLETE_BRIEF, HEDGEHOG_BRIEF, MOREL_BRIEF],
};

const SEASON: SeasonCurveData = {
  alleJahre: glocke(39, 32),
  laufendesJahr: glocke(39, 28).slice(0, 39),
  hoechstwert: 32,
  jahre: { von: 2015, bis: 2024 },
  stand: { jahr: 2025, woche: 39 },
  begehungen: 48_120,
  begehungenJeWocheAlleJahre: VISITS_ALL_YEARS,
  begehungenJeWocheLaufendesJahr: Array.from({ length: 39 }, (_, i) => (i > 36 ? 2 : 40)),
};

/** Die Angaben, die jedes Profil seit D1d trägt. */
const SOURCE = { url: 'https://www.123pilzsuche.de/daten/details/Steinpilze.htm', geprueftAm: '2026-09-10' };

const LEERE_MASSE = {
  hutBreiteCm: null,
  fruchtkoerperBreiteCm: null,
  fruchtkoerperHoeheCm: null,
  stielLaengeCm: null,
  stielDickeCm: null,
  sporenLaengeUm: null,
  sporenBreiteUm: null,
};

export const STEINPILZ: Species = {
  slug: 'steinpilz',
  name: 'Steinpilz',
  lateinisch: 'Boletus edulis',
  gruppe: 'roehrling',
  stufe: 'vorhersage',
  tags: ['vorhersage', 'roehrling', 'sommer', 'herbst', 'fichte', 'buche'],
  schutz: { status: 'besondersGeschuetzt', quelle: 'Bundesartenschutzverordnung, Anlage 1' },
  speisewert: 'essbar',
  kartenSlug: 'boletus_edulis',
  sammelbar: true,
  marktfaehigkeit: { marktfaehig: true, schweiz: true },
  wertigkeit: 1,
  haeufigkeit: 'haeufig',
  gefaehrdung: null,
  weitereNamen: ['Herrenpilz', 'Fichtensteinpilz'],
  synonyme: ['Boletus bulbosus'],
  masse: {
    ...LEERE_MASSE,
    hutBreiteCm: {
      von: 4,
      bis: 20,
      seltenVon: null,
      seltenBis: 25,
      einheit: 'cm',
      beschreibung: null,
    },
    sporenLaengeUm: {
      von: 12.4,
      bis: 19.2,
      seltenVon: null,
      seltenBis: null,
      einheit: 'um',
      beschreibung: null,
    },
    sporenBreiteUm: {
      von: 4.5,
      bis: 5.5,
      seltenVon: null,
      seltenBis: null,
      einheit: 'um',
      beschreibung: null,
    },
  },
  farben: {
    hut: [
      { name: 'hellbraun', hex: '#e2c79a' },
      { name: 'dunkelbraun', hex: '#6b4423' },
    ],
    sporenlager: [{ name: 'weiß', hex: '#f0ece0' }],
    stiel: [{ name: 'cremeweiß', hex: '#f2e8d5' }],
    fleisch: [],
    sporenpulver: [{ name: 'olivbraun', hex: '#7a5c2e' }],
    verfaerbung: {
      von: [{ name: 'weiß', hex: '#f4efe2' }],
      nach: [{ name: 'blau', hex: '#3f6ea8' }],
      dauer: 'schnell',
    },
  },
  zeitraum: { vonMonat: 6, bisMonat: 11, spitzeMonat: null },
  beobachteterZeitraum: { vonMonat: 8, bisMonat: 10 },
  geruch: { tags: ['pilzig', 'angenehm'], text: 'Sehr angenehm, pilzig.' },
  geschmack: { tags: ['mild', 'nussig'], text: 'Mild und nussig.' },
  quelle: SOURCE,
  reagenzien: [{ reagenz: 'koh', reaktion: 'Fleisch blass braun.' }],
  warnung: null,
  jahreszeiten: ['sommer', 'herbst'],
  baeume: ['fichte', 'buche'],
  baeumeAusErfahrung: null,
  vorhersageGeplant: true,
  begehungenMitFund: 1853,
  spitzeWoche: 40,
  merkmale: [
    { schluessel: 'hut', text: '6 bis 25 cm, hell- bis dunkelbraun.' },
    { schluessel: 'roehren', text: 'Jung weiß, später gelb bis olivgrün.' },
    { schluessel: 'stiel', text: 'Dick, bauchig, hellbraun.' },
    { schluessel: 'fleisch', text: 'Weiß, fest, verfärbt nicht.' },
    { schluessel: 'geruch', text: 'Angenehm pilzig.' },
    { schluessel: 'geschmack', text: 'Mild, nussig.' },
    { schluessel: 'sporenpulver', text: 'Olivbraun.' },
    { schluessel: 'vorkommen', text: 'Nadel- und Laubwald.' },
    { schluessel: 'zeit', text: 'Juli bis November.' },
    { schluessel: 'speisewert', text: 'Essbar.' },
    { schluessel: 'schutz', text: 'Besonders geschützt nach Bundesartenschutzverordnung.' },
  ],
  verwechslungen: [
    {
      slug: 'gallenroehrling',
      name: 'Gallenröhrling',
      lateinisch: 'Tylopilus felleus',
      unterschied: 'Röhren rosa, sehr bitter.',
      speisewert: 'ungeniessbar',
      warnung: null,
    },
    {
      slug: 'satansroehrling',
      name: 'Satansröhrling',
      lateinisch: 'Rubroboletus satanas',
      unterschied: null,
      speisewert: 'giftig',
      warnung: null,
    },
  ],
  links: [
    { titel: '123pilzsuche.de', url: 'https://www.123pilzsuche.de/daten/details/Steinpilze.htm' },
    { titel: 'Wikipedia', url: 'https://de.wikipedia.org/wiki/Gemeiner_Steinpilz' },
  ],
  saison: SEASON,
};

/** Eine Art der Stufe Profil: kein Manifest, keine Kurve. */
export const MORCHEL: Species = {
  ...STEINPILZ,
  slug: 'speisemorchel',
  name: 'Speisemorchel',
  lateinisch: 'Morchella esculenta',
  gruppe: 'morchel',
  stufe: 'profil',
  tags: ['profil', 'morchel', 'fruehling', 'esche'],
  schutz: KEIN_SCHUTZ,
  kartenSlug: null,
  begehungenMitFund: 12,
  spitzeWoche: null,
  saison: {
    ...SEASON,
    alleJahre: Array.from({ length: WEEKS }, () => 0),
    laufendesJahr: Array.from({ length: 39 }, () => 0),
    hoechstwert: 0,
  },
};

/** Ein Profil, das niemand sammelt: es steht im Katalog als Verwechslung. */
export const GALLENROEHRLING: Species = {
  ...STEINPILZ,
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  lateinisch: 'Tylopilus felleus',
  stufe: 'profil',
  tags: ['profil', 'roehrling', 'sommer', 'herbst'],
  schutz: KEIN_SCHUTZ,
  speisewert: 'giftig',
  kartenSlug: null,
  sammelbar: false,
  marktfaehigkeit: { marktfaehig: false, schweiz: null },
  wertigkeit: null,
  haeufigkeit: null,
  weitereNamen: [],
  synonyme: [],
  reagenzien: [],
  vorhersageGeplant: false,
  begehungenMitFund: 0,
  spitzeWoche: null,
  verwechslungen: [
    {
      slug: 'steinpilz',
      name: 'Steinpilz',
      lateinisch: 'Boletus edulis',
      unterschied: 'Netz hell, Geschmack mild.',
      speisewert: 'essbar',
      warnung: null,
    },
  ],
  saison: null,
};

/** `GET /api/arten?sammelbar=false`: nur die Profile, die niemand sammelt. */
export const LOOKALIKE_LIST: SpeciesCatalogue = {
  ...SPECIES_LIST,
  arten: [GALLENROEHRLING_KURZ],
};

/** `GET /api/arten?alle=true`: beide Töpfe, für die Suche über den Katalog. */
export const FULL_LIST: SpeciesCatalogue = {
  ...SPECIES_LIST,
  arten: [...SPECIES_LIST.arten, GALLENROEHRLING_KURZ],
};
