/**
 * Der Vertrag der eigenen Einträge, wie ihn `backend/app/modules/{funde,
 * marker,zonen}/schemas.py` festlegt. Jedes Enum des Backends steht hier als
 * Liste seiner Werte, aus der der Typ folgt.
 */

/** Wer ein Objekt sehen darf. */
export const SICHTBARKEITEN = ['privat', 'geteilt'] as const;
export type Sichtbarkeit = (typeof SICHTBARKEITEN)[number];

/** Die sechs Farben aus den Mockups. Eine freie Farbwahl gibt es nicht. */
export const FARBEN = ['gruen', 'braun', 'blau', 'rot', 'gold', 'grau'] as const;
export type Farbe = (typeof FARBEN)[number];

/** Ein Ausschnitt einer Liste, mit der Gesamtzahl dahinter. */
export interface Seite<E> {
  eintraege: E[];
  gesamt: number;
  limit: number;
  offset: number;
}

/** Ein abgelegtes Foto. Die Datei holt der Client über die eigene Route. */
export interface Foto {
  id: string;
  breite: number;
  hoehe: number;
  erstelltAm: string;
}

/** Ein eigener Fund, mit genauem Ort. */
export interface Fund {
  id: string;
  artSlug: string;
  lat: number;
  lon: number;
  /** ISO-Datum ohne Zeit, `2026-09-06`. */
  datum: string;
  anzahl: number | null;
  notiz: string | null;
  sichtbarkeit: Sichtbarkeit;
  fotos: Foto[];
  erstelltAm: string;
  geaendertAm: string;
}

/** Ein neuer Fund. Der Besitzer kommt aus dem Token, nie aus dem Körper. */
export interface FundEingabe {
  artSlug: string;
  lat: number;
  lon: number;
  datum: string;
  anzahl?: number | null;
  notiz?: string | null;
  sichtbarkeit: Sichtbarkeit;
}

/** Was sich an einem Fund ändern lässt. Weggelassene Felder bleiben. */
export type FundAenderung = Partial<FundEingabe>;

/**
 * Ein geteilter Fund, so wie ihn ein fremdes Konto sieht. `gerundet` sagt, ob
 * der Ort auf ein 5-km-Raster gelegt wurde; das gilt für geschützte Arten.
 */
export interface GeteilterFund {
  id: string;
  artSlug: string;
  lat: number;
  lon: number;
  gerundet: boolean;
  datum: string;
  anzahl: number | null;
  notiz: string | null;
  melder: string | null;
  eigen: boolean;
  fotos: number;
}

/** Ein eigener Marker: ein Punkt mit Name, Farbe und Notiz. */
export interface Marker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  farbe: Farbe;
  notiz: string | null;
  sichtbarkeit: Sichtbarkeit;
  erstelltAm: string;
  geaendertAm: string;
}

export interface MarkerEingabe {
  name: string;
  lat: number;
  lon: number;
  farbe: Farbe;
  notiz?: string | null;
  sichtbarkeit: Sichtbarkeit;
}

export type MarkerAenderung = Partial<MarkerEingabe>;

/** Eine Fläche als GeoJSON, mit genau einem geschlossenen Ring und ohne Löcher. */
export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

/** Eine eigene Zone. Die Fläche rechnet der Dienst, nie das Gerät. */
export interface Zone {
  id: string;
  name: string;
  polygon: GeoPolygon;
  flaecheHa: number;
  farbe: Farbe;
  notiz: string | null;
  sichtbarkeit: Sichtbarkeit;
  erstelltAm: string;
  geaendertAm: string;
}

export interface ZoneEingabe {
  name: string;
  polygon: GeoPolygon;
  farbe: Farbe;
  notiz?: string | null;
  sichtbarkeit: Sichtbarkeit;
}

export type ZoneAenderung = Partial<ZoneEingabe>;

/**
 * Was die Karte zu einer Zone zurückgibt. `flaechenmittel` ist das Mittel der
 * Vorhersage über die Fläche in Prozent je Begehung, für genau die genannte
 * Art und Woche. `eigeneFunde` zählt alle Arten und alle Jahre.
 */
export interface ZonenWert {
  art: string;
  woche: { jahr: number; woche: number };
  flaechenmittel: number;
  punkte: number;
  eigeneFunde: number;
}
