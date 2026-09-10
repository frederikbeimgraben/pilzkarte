/**
 * Ein Speicher für rohe Wertkacheln, begrenzt auf eine Zahl Bytes.
 *
 * Die Kacheln bleiben roh (ein Byte je Punkt), nicht gefärbt: gefärbt wären es
 * vier Bytes je Punkt, also 256 kB je Kachel statt der 5 bis 40 kB, die vom
 * Server kommen. Der Speicher trägt so die vorgeladenen Nachbarwochen, ohne
 * dass der Wochenwechsel wieder ins Netz muss.
 */
export class TileCache {
  // Eine Map behält die Reihenfolge des Einfügens. Der älteste Eintrag steht
  // vorn und fliegt zuerst, wenn die Grenze erreicht ist.
  private readonly eintraege = new Map<string, ArrayBuffer | null>();
  private used = 0;

  constructor(private readonly bound: number) {}

  /** `undefined` heißt „unbekannt“, `null` heißt „geprüft, es gibt sie nicht“. */
  get(url: string): ArrayBuffer | null | undefined {
    const content = this.eintraege.get(url);
    if (content === undefined) return undefined;
    // Ein Treffer wird wieder jung, sonst würde die Kachel unter dem Finger
    // verdrängt, die gerade dauernd gebraucht wird.
    this.eintraege.delete(url);
    this.eintraege.set(url, content);
    return content;
  }

  put(url: string, content: ArrayBuffer | null): void {
    const alt = this.eintraege.get(url);
    if (alt !== undefined) this.used -= alt?.byteLength ?? 0;
    this.eintraege.set(url, content);
    this.used += content?.byteLength ?? 0;
    for (const [oldest, value] of this.eintraege) {
      if (this.used <= this.bound) break;
      if (oldest === url) break;
      this.eintraege.delete(oldest);
      this.used -= value?.byteLength ?? 0;
    }
  }

  get bytes(): number {
    return this.used;
  }

  get anzahl(): number {
    return this.eintraege.size;
  }
}
