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
    speisewert: 'speisepilz',
    kartenSlug: null,
    begehungenMitFund: 1853,
    spitzeWoche: 40,
    saison: { alleJahre: glocke(39, 32), hoechstwert: 32 },
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

export const MORCHEL_KURZ = kurz({
  slug: 'speisemorchel',
  name: 'Speisemorchel',
  lateinisch: 'Morchella esculenta',
  gruppe: 'morchel',
  stufe: 'profil',
  tags: ['profil', 'morchel', 'fruehling', 'esche'],
  begehungenMitFund: 0,
  spitzeWoche: null,
  saison: { alleJahre: Array.from({ length: WOCHEN }, () => 0), hoechstwert: 0 },
});

export const ARTEN_LISTE: ArtenListe = {
  stand: { jahr: 2025, woche: 39 },
  jahre: { von: 2015, bis: 2024 },
  begehungen: 48_120,
  begehungenJeWocheAlleJahre: BEGEHUNGEN_ALLE,
  begehungenJeWocheLaufendesJahr: BEGEHUNGEN_LAUFEND,
  arten: [STEINPILZ_KURZ, MARONE_KURZ, MORCHEL_KURZ],
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

export const STEINPILZ: Art = {
  slug: 'steinpilz',
  name: 'Steinpilz',
  lateinisch: 'Boletus edulis',
  gruppe: 'roehrling',
  stufe: 'vorhersage',
  tags: ['vorhersage', 'roehrling', 'sommer', 'herbst', 'fichte', 'buche'],
  geschuetzt: true,
  speisewert: 'speisepilz',
  kartenSlug: 'boletus_edulis',
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
    { name: 'Gallenröhrling', merkmal: 'Röhren rosa, sehr bitter.', essbar: 'ungeniessbar' },
    { name: 'Satansröhrling', merkmal: 'Stiel mit rotem Netz.', essbar: 'giftig' },
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
