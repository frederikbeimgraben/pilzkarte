/**
 * Der Vertrag der eigenen Einträge, wie ihn `backend/app/modules/{funde,
 * marker,zonen}/schemas.py` festlegt. Jedes Enum des Backends steht hier als
 * Liste seiner Werte, aus der der Typ folgt.
 */

/** Wer ein Objekt sehen darf. */
export const VISIBILITIES = ['privat', 'geteilt'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Die sechs Farben aus den Mockups. Eine freie Farbwahl gibt es nicht. */
export const COLORS = ['gruen', 'braun', 'blau', 'rot', 'gold', 'grau'] as const;
export type Color = (typeof COLORS)[number];

/** Ein Ausschnitt einer Liste, mit der Gesamtzahl dahinter. */
export interface Page<E> {
  eintraege: E[];
  gesamt: number;
  limit: number;
  offset: number;
}

/** Ein abgelegtes Foto. Die Datei holt der Client über die eigene Route. */
export interface Photo {
  id: string;
  breite: number;
  hoehe: number;
  erstelltAm: string;
}

/** Ein eigener Fund, mit genauem Ort. */
export interface Find {
  id: string;
  artSlug: string;
  lat: number;
  lon: number;
  /** ISO-Datum ohne Zeit, `2026-09-06`. */
  datum: string;
  anzahl: number | null;
  notiz: string | null;
  sichtbarkeit: Visibility;
  /**
   * Die Freigabe für das Modell. Sie steht neben der Sichtbarkeit: geteilt
   * heißt für andere gerundet, für das Training zählt nur der genaue Punkt.
   */
  fuerTraining: boolean;
  fotos: Photo[];
  erstelltAm: string;
  geaendertAm: string;
}

/** Ein neuer Fund. Der Besitzer kommt aus dem Token, nie aus dem Körper. */
export interface FindInput {
  artSlug: string;
  lat: number;
  lon: number;
  datum: string;
  anzahl?: number | null;
  notiz?: string | null;
  sichtbarkeit: Visibility;
  /** Siehe {@link Find.fuerTraining}. Ohne Angabe bleibt der Fund draußen. */
  fuerTraining?: boolean;
}

/** Was sich an einem Fund ändern lässt. Weggelassene Felder bleiben. */
export type FindPatch = Partial<FindInput>;

/**
 * Ein geteilter Fund, so wie ihn ein fremdes Konto sieht. `gerundet` sagt, ob
 * der Ort auf ein 5-km-Raster gelegt wurde; das gilt für geschützte Arten.
 */
export interface SharedFind {
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
  farbe: Color;
  notiz: string | null;
  sichtbarkeit: Visibility;
  erstelltAm: string;
  geaendertAm: string;
}

export interface MarkerInput {
  name: string;
  lat: number;
  lon: number;
  farbe: Color;
  notiz?: string | null;
  sichtbarkeit: Visibility;
}

export type MarkerPatch = Partial<MarkerInput>;

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
  farbe: Color;
  notiz: string | null;
  sichtbarkeit: Visibility;
  erstelltAm: string;
  geaendertAm: string;
}

export interface ZoneInput {
  name: string;
  polygon: GeoPolygon;
  farbe: Color;
  notiz?: string | null;
  sichtbarkeit: Visibility;
}

export type ZonePatch = Partial<ZoneInput>;

/**
 * Was die Karte zu einer Zone zurückgibt. `flaechenmittel` ist das Mittel der
 * Vorhersage über die Fläche in Prozent je Begehung, für genau die genannte
 * Art und Woche. `eigeneFunde` zählt alle Arten und alle Jahre.
 */
export interface ZoneValue {
  art: string;
  woche: { jahr: number; woche: number };
  flaechenmittel: number;
  punkte: number;
  eigeneFunde: number;
}
