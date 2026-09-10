import type { Art, ArtenListe, ArtKurz, SaisonKurve } from '../core/api/models';

const WOCHEN = 52;

/** Eine Glocke über dem Herbst, damit die Kurve etwas zu zeichnen hat. */
function glocke(spitze: number, hoehe: number): number[] {
  return Array.from({ length: WOCHEN }, (_, i) => Math.max(0, hoehe - Math.abs(i - spitze) * 2));
}

const BEGEHUNGEN_ALLE = Array.from({ length: WOCHEN }, (_, i) => (i < 4 ? 5 : 120));
const BEGEHUNGEN_LAUFEND = Array.from({ length: 36 }, (_, i) => (i > 33 ? 2 : 40));

function kurz(art: Partial<ArtKurz> & Pick<ArtKurz, 'slug' | 'name' | 'lateinisch'>): ArtKurz {
  return {
    gruppe: 'roehrling',
    stufe: 'vorhersage',
    tags: ['vorhersage', 'roehrling', 'sommer', 'herbst', 'fichte'],
    geschuetzt: false,
    speisewert: 'guterSpeisepilz',
    kartenSlug: null,
    sammelbar: true,
    marktfaehig: true,
    marktfaehigSchweiz: null,
    wertigkeit: 1,
    haeufigkeit: 'haeufig',
    gefaehrdung: null,
    warnung: null,
    jahreszeiten: ['sommer', 'herbst'],
    baeume: ['fichte'],
    baeumeAusErfahrung: null,
    vorhersageGeplant: true,
    begehungenMitFund: 1853,
    spitzeWoche: 40,
    saison: { alleJahre: glocke(39, 32), laufendesJahr: glocke(39, 28).slice(0, 36), hoechstwert: 32 },
    ...art,
  };
}

export const STEINPILZ_KURZ = kurz({
  slug: 'steinpilz',
  name: 'Steinpilz',
  lateinisch: 'Boletus edulis',
  geschuetzt: true,
  kartenSlug: 'boletus_edulis',
  tags: ['vorhersage', 'roehrling', 'sommer', 'herbst', 'fichte', 'buche'],
});

export const MARONE_KURZ = kurz({
  slug: 'maronenroehrling',
  name: 'Maronenröhrling',
  lateinisch: 'Imleria badia',
  kartenSlug: 'imleria_badia',
});

export const SEMMEL_KURZ = kurz({
  slug: 'semmelstoppelpilz',
  name: 'Semmelstoppelpilz',
  lateinisch: 'Hydnum repandum',
  gruppe: 'stoppelpilz',
  stufe: 'saison',
  tags: ['saison', 'stoppelpilz', 'sommer', 'herbst', 'buche'],
  begehungenMitFund: 180,
});

export const MORCHEL_KURZ = kurz({
  slug: 'speisemorchel',
  name: 'Speisemorchel',
  lateinisch: 'Morchella esculenta',
  gruppe: 'morchel',
  stufe: 'profil',
  tags: ['profil', 'morchel', 'fruehling', 'esche'],
  begehungenMitFund: 0,
  spitzeWoche: null,
  saison: {
    alleJahre: Array.from({ length: WOCHEN }, () => 0),
    laufendesJahr: Array.from({ length: 36 }, () => 0),
    hoechstwert: 0,
  },
});

export const GALLENROEHRLING_KURZ: ArtKurz = {
  ...MARONE_KURZ,
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  lateinisch: 'Tylopilus felleus',
  stufe: 'verwechslung',
  tags: ['verwechslung', 'roehrling', 'sommer', 'herbst'],
  speisewert: 'giftig',
  kartenSlug: null,
  sammelbar: false,
  marktfaehig: false,
  marktfaehigSchweiz: null,
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

export const ARTEN_LISTE: ArtenListe = {
  stand: { jahr: 2025, woche: 39 },
  jahre: { von: 2015, bis: 2024 },
  begehungen: 48_120,
  begehungenJeWocheAlleJahre: BEGEHUNGEN_ALLE,
  begehungenJeWocheLaufendesJahr: BEGEHUNGEN_LAUFEND,
  arten: [STEINPILZ_KURZ, MARONE_KURZ, SEMMEL_KURZ, MORCHEL_KURZ],
};

const SAISON: SaisonKurve = {
  alleJahre: glocke(39, 32),
  laufendesJahr: glocke(39, 28).slice(0, 39),
  hoechstwert: 32,
  jahre: { von: 2015, bis: 2024 },
  stand: { jahr: 2025, woche: 39 },
  begehungen: 48_120,
  begehungenJeWocheAlleJahre: BEGEHUNGEN_ALLE,
  begehungenJeWocheLaufendesJahr: Array.from({ length: 39 }, (_, i) => (i > 36 ? 2 : 40)),
};

/** Die Angaben, die jedes Profil seit D1d trägt. */
const QUELLE = { url: 'https://www.123pilzsuche.de/daten/details/Steinpilze.htm', geprueftAm: '2026-09-10' };

const LEERE_MASSE = {
  hutBreiteCm: null,
  fruchtkoerperBreiteCm: null,
  fruchtkoerperHoeheCm: null,
  stielLaengeCm: null,
  stielDickeCm: null,
  sporenLaengeUm: null,
  sporenBreiteUm: null,
};

export const STEINPILZ: Art = {
  slug: 'steinpilz',
  name: 'Steinpilz',
  lateinisch: 'Boletus edulis',
  gruppe: 'roehrling',
  stufe: 'vorhersage',
  tags: ['vorhersage', 'roehrling', 'sommer', 'herbst', 'fichte', 'buche'],
  geschuetzt: true,
  speisewert: 'guterSpeisepilz',
  kartenSlug: 'boletus_edulis',
  sammelbar: true,
  marktfaehig: true,
  marktfaehigkeit: { marktfaehig: true, quelle: { ...QUELLE, geprueftAm: '2026-05-01' } },
  wertigkeit: 1,
  haeufigkeit: 'haeufig',
  gefaehrdung: null,
  weitereNamen: ['Herrenpilz', 'Fichtensteinpilz'],
  synonyme: ['Boletus bulbosus'],
  masse: {
    ...LEERE_MASSE,
    hutBreiteCm: { von: 4, bis: 20, seltenBis: 25 },
    sporenLaengeUm: { von: 12.4, bis: 19.2, seltenBis: null },
    sporenBreiteUm: { von: 4.5, bis: 5.5, seltenBis: null },
  },
  quelle: QUELLE,
  reagenzien: [{ reagenz: 'koh', reaktion: 'Fleisch blass braun.' }],
  marktfaehigSchweiz: null,
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
    { schluessel: 'speisewert', text: 'Guter Speisepilz.' },
    { schluessel: 'schutz', text: 'Besonders geschützt nach Bundesartenschutzverordnung.' },
  ],
  verwechslungen: [
    {
      name: 'Gallenröhrling',
      merkmal: 'Röhren rosa, sehr bitter.',
      essbar: 'ungeniessbar',
      slug: 'gallenroehrling',
    },
    { name: 'Satansröhrling', merkmal: 'Stiel mit rotem Netz.', essbar: 'giftig', slug: null },
  ],
  links: [
    { titel: '123pilzsuche.de', url: 'https://www.123pilzsuche.de/daten/details/Steinpilze.htm' },
    { titel: 'Wikipedia', url: 'https://de.wikipedia.org/wiki/Gemeiner_Steinpilz' },
  ],
  saison: SAISON,
};

/** Eine Art der Stufe Profil: kein Manifest, keine Kurve. */
export const MORCHEL: Art = {
  ...STEINPILZ,
  slug: 'speisemorchel',
  name: 'Speisemorchel',
  lateinisch: 'Morchella esculenta',
  gruppe: 'morchel',
  stufe: 'profil',
  tags: ['profil', 'morchel', 'fruehling', 'esche'],
  geschuetzt: false,
  kartenSlug: null,
  begehungenMitFund: 12,
  spitzeWoche: null,
  saison: {
    ...SAISON,
    alleJahre: Array.from({ length: WOCHEN }, () => 0),
    laufendesJahr: Array.from({ length: 39 }, () => 0),
    hoechstwert: 0,
  },
};

/** Ein Profil, das niemand sammelt: es steht im Katalog als Verwechslung. */
export const GALLENROEHRLING: Art = {
  ...STEINPILZ,
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  lateinisch: 'Tylopilus felleus',
  stufe: 'verwechslung',
  tags: ['verwechslung', 'roehrling', 'sommer', 'herbst'],
  geschuetzt: false,
  speisewert: 'giftig',
  kartenSlug: null,
  sammelbar: false,
  marktfaehigkeit: { marktfaehig: false, quelle: { ...QUELLE, geprueftAm: '2026-05-01' } },
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
      name: 'Steinpilz',
      merkmal: 'Netz hell, Geschmack mild.',
      essbar: 'guterSpeisepilz',
      slug: 'steinpilz',
    },
  ],
  saison: null,
};

/** `GET /api/arten?sammelbar=false`: nur die Profile, die niemand sammelt. */
export const VERWECHSLUNG_LISTE: ArtenListe = {
  ...ARTEN_LISTE,
  arten: [GALLENROEHRLING_KURZ],
};

/** `GET /api/arten?alle=true`: beide Töpfe, für die Suche über den Katalog. */
export const ALLE_LISTE: ArtenListe = {
  ...ARTEN_LISTE,
  arten: [...ARTEN_LISTE.arten, GALLENROEHRLING_KURZ],
};
