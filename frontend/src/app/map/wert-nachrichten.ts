import type { WertSkala } from './wert-farben';

/** Was der Hauptfaden dem Färbe-Worker schickt und was zurückkommt. */

export interface FaerbeAuftrag {
  typ: 'faerbe';
  id: number;
  url: string;
  /** Wie das Byte zu lesen ist: Vorhersage einer Art oder Spanne einer Ebene. */
  skala: WertSkala;
  farben: readonly string[];
}

export interface VorladeAuftrag {
  typ: 'vorladen';
  urls: readonly string[];
}

export type WertAuftrag = FaerbeAuftrag | VorladeAuftrag;

/** `bild` ist `null`, wenn es die Kachel nicht gibt. Das ist kein Fehler. */
export interface WertAntwort {
  id: number;
  bild: ImageBitmap | null;
}
