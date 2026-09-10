import type { Fund, GeteilterFund, Marker, Seite, Zone } from '../core/api/models';

/** Eine Seite, wie sie jede Liste des Dienstes liefert. */
export function seite<E>(eintraege: E[]): Seite<E> {
  return { eintraege, gesamt: eintraege.length, limit: 200, offset: 0 };
}

export const FUND: Fund = {
  id: 'fund-eins',
  artSlug: 'steinpilz',
  lat: 48.5203,
  lon: 9.0511,
  datum: '2026-09-06',
  anzahl: 3,
  notiz: 'Unter Fichten am Weg, drei junge, Kappen noch geschlossen.',
  sichtbarkeit: 'geteilt',
  fotos: [{ id: 'foto-eins', breite: 1600, hoehe: 1200, erstelltAm: '2026-09-06T10:00:00+02:00' }],
  erstelltAm: '2026-09-06T10:00:00+02:00',
  geaendertAm: '2026-09-06T10:00:00+02:00',
};

export const MARKER: Marker = {
  id: 'marker-eins',
  name: 'Alter Fichtenhang',
  lat: 48.53,
  lon: 9.06,
  farbe: 'blau',
  notiz: 'Nordhang, ab Mitte September.',
  sichtbarkeit: 'privat',
  erstelltAm: '2026-09-01T10:00:00+02:00',
  geaendertAm: '2026-09-01T10:00:00+02:00',
};

export const ZONE: Zone = {
  id: 'zone-eins',
  name: 'Schönbuch Nord',
  polygon: {
    type: 'Polygon',
    coordinates: [
      [
        [9.0, 48.5],
        [9.1, 48.5],
        [9.1, 48.6],
        [9.0, 48.6],
        [9.0, 48.5],
      ],
    ],
  },
  flaecheHa: 42,
  farbe: 'gruen',
  notiz: 'Nordhang, alte Fichten, ab Mitte September.',
  sichtbarkeit: 'privat',
  erstelltAm: '2026-09-01T10:00:00+02:00',
  geaendertAm: '2026-09-01T10:00:00+02:00',
};

export const GETEILTER_FUND: GeteilterFund = {
  id: 'geteilt-eins',
  artSlug: 'maronenroehrling',
  lat: 48.6,
  lon: 9.2,
  gerundet: true,
  datum: '2026-09-04',
  anzahl: 5,
  notiz: 'Wiese am Waldrand, viele junge',
  melder: 'Jonas',
  eigen: false,
  fotos: 0,
};
