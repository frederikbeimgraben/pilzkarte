/** Was der Hauptfaden dem Färbe-Worker schickt und was zurückkommt. */

export interface FaerbeAuftrag {
  typ: 'faerbe';
  id: number;
  url: string;
  /** Höchstwert der Art aus dem Manifest; er bestimmt die Nachschlagetabelle. */
  top: number;
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
