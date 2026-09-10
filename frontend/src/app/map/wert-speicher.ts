/**
 * Ein Speicher für rohe Wertkacheln, begrenzt auf eine Zahl Bytes.
 *
 * Die Kacheln bleiben roh (ein Byte je Punkt), nicht gefärbt: gefärbt wären es
 * vier Bytes je Punkt, also 256 kB je Kachel statt der 5 bis 40 kB, die vom
 * Server kommen. Der Speicher trägt so die vorgeladenen Nachbarwochen, ohne
 * dass der Wochenwechsel wieder ins Netz muss.
 */
export class KachelSpeicher {
  // Eine Map behält die Reihenfolge des Einfügens. Der älteste Eintrag steht
  // vorn und fliegt zuerst, wenn die Grenze erreicht ist.
  private readonly eintraege = new Map<string, ArrayBuffer | null>();
  private belegt = 0;

  constructor(private readonly grenze: number) {}

  /** `undefined` heißt „unbekannt“, `null` heißt „geprüft, es gibt sie nicht“. */
  hole(url: string): ArrayBuffer | null | undefined {
    const inhalt = this.eintraege.get(url);
    if (inhalt === undefined) return undefined;
    // Ein Treffer wird wieder jung, sonst würde die Kachel unter dem Finger
    // verdrängt, die gerade dauernd gebraucht wird.
    this.eintraege.delete(url);
    this.eintraege.set(url, inhalt);
    return inhalt;
  }

  lege(url: string, inhalt: ArrayBuffer | null): void {
    const alt = this.eintraege.get(url);
    if (alt !== undefined) this.belegt -= alt?.byteLength ?? 0;
    this.eintraege.set(url, inhalt);
    this.belegt += inhalt?.byteLength ?? 0;
    for (const [aeltester, wert] of this.eintraege) {
      if (this.belegt <= this.grenze) break;
      if (aeltester === url) break;
      this.eintraege.delete(aeltester);
      this.belegt -= wert?.byteLength ?? 0;
    }
  }

  get bytes(): number {
    return this.belegt;
  }

  get anzahl(): number {
    return this.eintraege.size;
  }
}
