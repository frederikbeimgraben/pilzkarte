/** Beispielwerte der Werkstattseite: Zahlen und lateinische Namen ohne eigenen Textschlüssel. */
import type { Licence, Photo } from '../../core/api/models';
import type { ColourValue, Span, TimelineWeek } from '../../ui';

/** Die acht Wochen des Artboards. Die Jahresmarke steht auf KW 41. */
export const SAMPLE_WEEKS: readonly TimelineWeek[] = [
  { year: 2025, week: 36, share: 0.48, forecast: false },
  { year: 2025, week: 37, share: 0.62, forecast: false },
  { year: 2025, week: 38, share: 0.7, forecast: false },
  { year: 2025, week: 39, share: 0.88, forecast: false },
  { year: 2025, week: 40, share: 1, forecast: false },
  { year: 2026, week: 41, share: 0.76, forecast: true },
  { year: 2026, week: 42, share: 0.6, forecast: true },
  { year: 2026, week: 43, share: 0.45, forecast: true },
];

/** Dieselben Wochen ohne Jahreswechsel: das Blatt zeigt keine Marke. */
export const SAMPLE_WEEKS_FLAT: readonly TimelineWeek[] = SAMPLE_WEEKS.map((week) => ({
  ...week,
  year: 2025,
}));

/** Die Saisonkurve als Glocke um die Spitzenwoche. */
function seasonValue(week: number, peak: number, offset: number, factor: number): number {
  const position = week - peak - offset;
  return (
    factor *
    (Math.exp(-(position * position) / 26) + 0.25 * Math.exp(-((position + 6) * (position + 6)) / 40))
  );
}

export const SAMPLE_ALL_YEARS: readonly number[] = Array.from({ length: 52 }, (_, i) =>
  seasonValue(i + 1, 40, 0, 1),
);

export const SAMPLE_CURRENT_YEAR: readonly number[] = Array.from({ length: 39 }, (_, i) =>
  seasonValue(i + 1, 40, -1.5, 1.1),
);

/** Die 40 Klassen des Histogramms. */
export const SAMPLE_HISTOGRAM: readonly number[] = Array.from({ length: 40 }, (_, i) => {
  const one = i - 14;
  const two = i - 30;
  return Math.exp(-(one * one) / 90) + 0.35 * Math.exp(-(two * two) / 60);
});

/** Fünf lateinische Artnamen für Zeilen, die kein Schlüssel deckt. */
export const LATIN_NAMES: readonly string[] = [
  'Boletus edulis',
  'Cantharellus cibarius',
  'Leccinum scabrum',
  'Amanita muscaria',
  'Imleria badia',
];

/** Zwei Gattungen als Beispiel für eine Marke ohne Interaktion. */
export const TREE_GENERA: readonly string[] = ['Fagus', 'Quercus', 'Picea', 'Pinus'];

/** Farbfelder mit lateinischen Kennwörtern statt einem deutschen Farbnamen. */
export const CAP_COLOURS: readonly ColourValue[] = [
  { name: 'fulvus', hex: '#c8a25a' },
  { name: 'badius', hex: '#6b4423' },
];
export const FLESH_COLOURS: readonly ColourValue[] = [{ name: 'candidus', hex: '#f4efe2' }];
export const BRUISE_COLOURS: readonly ColourValue[] = [{ name: 'caeruleus', hex: '#3f6ea8' }];
export const GRADIENT_COLOURS: readonly ColourValue[] = [
  { name: 'stramineus', hex: '#e2c79a' },
  { name: 'badius', hex: '#6b4423' },
];
export const MULTI_COLOURS: readonly ColourValue[] = [
  { name: 'eburneus', hex: '#f0ece0' },
  { name: 'olivaceus', hex: '#cfd08a' },
];

/** Die Hutfarben der beiden verglichenen Arten, je ein Verlauf. */
export const CAP_GRADIENTS: readonly (readonly ColourValue[])[] = [
  [
    { name: 'stramineus', hex: '#e2c79a' },
    { name: 'badius', hex: '#6b4423' },
  ],
  [
    { name: 'cremeus', hex: '#d8b98a' },
    { name: 'umbrinus', hex: '#8a6a3a' },
  ],
];

/** Die Röhren der beiden Arten: zwei Töne hart getrennt, dann einer. */
export const TUBE_COLOURS: readonly (readonly ColourValue[])[] = [
  [
    { name: 'eburneus', hex: '#f0ece0' },
    { name: 'olivaceus', hex: '#cfd08a' },
  ],
  [{ name: 'roseus', hex: '#e8c8cf' }],
];

/** Die Druckprobe je Art: der erste Ton, dann der spätere, wenn er kommt. */
export const PRESS_COLOURS: readonly {
  readonly from: readonly ColourValue[];
  readonly to: readonly ColourValue[];
}[] = [
  { from: [{ name: 'eburneus', hex: '#f0ece0' }], to: [] },
  { from: [{ name: 'roseus', hex: '#e8c8cf' }], to: [{ name: 'rubens', hex: '#d9a0ac' }] },
];

/** Drei Töne über eine Fläche, wie das Board sie am Täubling zeigt. */
export const TRIPLE_COLOURS: readonly ColourValue[] = [
  { name: 'purpureus', hex: '#7a3b6a' },
  { name: 'viridis', hex: '#4f7a3a' },
  { name: 'olivaceus', hex: '#7f8a3a' },
];

/** Die Schlüssel zu den zwölf Tönen, in derselben Reihenfolge. */
export const PICKER_TONE_KEYS = [
  'beispiel.ton.weiss',
  'beispiel.ton.creme',
  'beispiel.ton.gelb',
  'beispiel.ton.orange',
  'beispiel.ton.rotbraun',
  'beispiel.ton.braun',
  'beispiel.ton.dunkelbraun',
  'beispiel.ton.oliv',
  'beispiel.ton.gruen',
  'beispiel.ton.rot',
  'beispiel.ton.violett',
  'beispiel.ton.grau',
] as const;

/** Die zwölf Töne der Farbwahl, wie das Board sie zeigt. */
export const PICKER_TONES: readonly string[] = [
  '#f3efe6',
  '#e8d9b5',
  '#e0b446',
  '#d1832f',
  '#a0522d',
  '#6b4423',
  '#3e2a17',
  '#7f8a3a',
  '#4f7a3a',
  '#b8322a',
  '#7a3b6a',
  '#8a8f8a',
];

/** Die sechs nächsten Töne des Katalogs unter der Farbwahl. */
export const NEAREST_TONES: readonly string[] = [
  '#6b4423',
  '#5e3d22',
  '#7a5230',
  '#8a4e2b',
  '#5a3a1e',
  '#4a3220',
];

/** Der Wert des Farbcode-Felds. */
export const COLOUR_CODE = '#7A3B6A';

/** Zwei Spannen: die übliche Breite, darunter die seltene Ausnahme. */
export const CAP_WIDTH_SPANS: readonly Span[] = [{ from: 4, to: 20 }];

/** Dieselbe Breite mit der seltenen Ausnahme darüber. */
export const CAP_RARE_SPANS: readonly Span[] = [
  { from: 4, to: 20 },
  { from: 20, to: 25 },
];
export const SPORE_LENGTH_SPANS: readonly Span[] = [
  { from: 12.4, to: 19.2 },
  { from: 4.5, to: 5.5 },
];
export const STEM_HEIGHT_SPANS: readonly Span[] = [{ from: 5, to: 15 }];
export const STEM_THICKNESS_SPANS: readonly Span[] = [{ from: 2, to: 6 }];

const LICENCE: Licence = 'cc_by_sa_4';

/** Ein Bild für Kachel, Herkunftszeile, großen Betrachter und geladenes Bild. */
export const SAMPLE_IMAGE: Photo = {
  id: 'bild-eins',
  ownerId: null,
  speciesId: 'art-eins',
  findId: null,
  width: 1600,
  height: 1200,
  photographer: 'Marie Weber',
  ownerName: 'Marie',
  licence: LICENCE,
  caption: null,
  takenOn: '2026-09-06',
  lat: null,
  lon: null,
  lead: true,
  state: 'approved',
  rejectReason: null,
  reviewedById: null,
  reviewedAt: null,
  createdAt: '2026-09-06T08:00:00+02:00',
  updatedAt: '2026-09-06T08:00:00+02:00',
};

/** Das Bild des Betrachters. Das Board zeigt es höher als die Kachel. */
export const SAMPLE_IMAGE_LARGE: SpeciesImage = {
  ...SAMPLE_IMAGE,
  id: 'bild-zwei',
  lat: 48.51,
  lon: 9.06,
  url: '/api/species-images/bild-zwei/full',
  thumbUrl: '/api/species-images/bild-zwei/thumb',
};

/** Das Bild hinter dem Schloss. Das Board zeigt es flacher als die Kachel. */
export const SAMPLE_IMAGE_PRIVATE = '/api/species-images/bild-drei/thumb';

/** Zwei Vorschaubilder der Fotowahl, in den Farben des Boards. */
export const SAMPLE_THUMBS: readonly string[] = [
  'iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAIAAADajyQQAAABh0lEQVR42t3aYQ7CIAyG4TbpubyQN/HUFtygwNj821fjNqdjeWIk5QP7vF+qKiJhI+GwHJRt22v8/Dg5Xd8bCd+OjYwXLY2EU/FeD42M9zKkyh+GVPmBIVVafzGgyk8ZUuVPQ6pK54FU+RtDqs7uHqeq3T1RVbt7oursPHAq3xtSJa0Ihql+JRVQVXpFpKqOx4iqUgQjVf4ypErPETRNVcdjRJXGIpik6kUwTHUUwTzVJn7Lr7qK3xCqJX6jqMb4DaQK8RtL1UbQNFWN34iq2t0TVeU/hlSJLvEbQzXHbxjVEL+RVDLNQWNUGotgkqoXwTDVUQTzVLfxW2bVPn5LrtrEb/lVV/EbQrXEbxTVGL+BVCF+Y6mW5RAUlQ7LIUAq6cshWKq2loqm0nUOmqGSaQ4ao9JYBJNUvQiGqdoCFprqj/gtp+opfkuruo3fMqv28Vty1SZ+y6+6it8QqiV+o6jG+A2k0h6/sVRtBE1T/ZZDAFW6zkEzVDLNQWNUGotgkqoXwTCV774FmRlBUMNqygAAAABJRU5ErkJggg==',
  'iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAIAAADajyQQAAABaElEQVR42t3ZQQ7CIBBGYUg4Xe/gGbz/TlqstjAD0+X/YkJj7ebL6LyF5fXecs4ppe/xP1P4/u3jxf39+L26J+L3u5dxvyBV9V1BqupRkKr9q4hUdRPjqPLxGwOq6gMFqcrnVqSp2m8MqGpbEagKdkxPFemYpGrZMVXVvGPCqknHtFVex+RVZscIqrFjEJW3FeVV5lYkqMatCFF1W5GjahMDqp50TEoV7piaKtYxQVWgY5qqVcdkVdOOKav8jomrnI7pq6yOIVRDxyiqe8dAqkvHWKqzYzjVsRWJqmNiRNX+5zpSVa8FqWoTA6raxICqbmIcVT0KUpXS445pqNrEgKpHHVNSxTsmpgp2TE8V6ZikatkxVdW8Y8KqSce0VV7H5FVmxwiqsWMQlbcV5VXmViSoxq0IUXVbkaNqEwOqAh3TVK06JquadkxZ5XdMXOV0TF9ldQyhGjpGUd07BlJdJsZSnR3DqerlA0eYHYDEOqZ1AAAAAElFTkSuQmCC',
];

/** Die Vorschaubilder der Arten, wie das Board sie einfärbt. */
export const SPECIES_THUMBS = {
  stein: '/api/species-images/art-stein/thumb',
  steinHell: '/api/species-images/art-stein-hell/thumb',
  marone: '/api/species-images/art-marone/thumb',
  pfifferling: '/api/species-images/art-pfifferling/thumb',
} as const;

/** Das Foto der Prüfkarte. Das Board zeichnet es wärmer als eine Fläche. */
export const SAMPLE_PHOTO = '/api/species-images/bild-vier/full';
