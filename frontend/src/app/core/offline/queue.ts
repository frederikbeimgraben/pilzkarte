import { Injectable, inject, signal } from '@angular/core';
import { openDB, type IDBPDatabase } from 'idb';
import { firstValueFrom } from 'rxjs';
import { EntriesApi } from '../api/entries.api';
import type { FindInput, MarkerInput, ZoneInput } from '../api/models';

/** Was in der Warteschlange liegen kann. */
export type QueueKind = 'fund' | 'marker' | 'zone';

/** Die Eingabe, die zu einer Art gehört. */
export interface QueueBody {
  fund: FindInput;
  marker: MarkerInput;
  zone: ZoneInput;
}

/**
 * Ein Eintrag, der noch nicht beim Server liegt. Fotos liegen als Blob daneben,
 * weil eine Datei den Neustart des Browsers nicht überlebt.
 */
export interface QueueEntry<A extends QueueKind = QueueKind> {
  id: string;
  art: A;
  body: QueueBody[A];
  fotos: Blob[];
  erstelltAm: string;
}

/** Name und Fassung der Datenbank. F1 baut denselben Speicher aus. */
const DB_NAME = 'pilzkarte';
const DB_VERSION = 1;
const CACHE = 'warteschlange';

/**
 * Die Warteschlange für Einträge ohne Verbindung oder ohne Konto.
 *
 * Sie kann drei Dinge: anlegen, auflisten und später senden. Alles Weitere —
 * Wiederholung mit Abstand, Hintergrund-Synchronisierung, Aufräumen — kommt in
 * F1. Ohne IndexedDB (privates Fenster, gesperrter Speicher) bleibt sie leer,
 * statt den Eintrag zu verlieren: der Aufrufer erfährt es am Rückgabewert.
 */
@Injectable({ providedIn: 'root' })
export class Queue {
  private readonly api = inject(EntriesApi);
  private db: Promise<IDBPDatabase | null> | null = null;

  private readonly _eintraege = signal<readonly QueueEntry[]>([]);

  /** Was gerade wartet. Die Liste zeigt diese Einträge mit Badge. */
  readonly eintraege = this._eintraege.asReadonly();

  /** Legt einen Eintrag ab und gibt ihn zurück, oder `null` ohne Speicher. */
  async put<A extends QueueKind>(
    art: A,
    body: QueueBody[A],
    fotos: readonly Blob[] = [],
  ): Promise<QueueEntry<A> | null> {
    const entry: QueueEntry<A> = {
      id: crypto.randomUUID(),
      art,
      body,
      fotos: [...fotos],
      erstelltAm: new Date().toISOString(),
    };
    const db = await this.open();
    if (db === null) return null;
    await db.put(CACHE, entry);
    await this.read();
    return entry;
  }

  /** Liest die Warteschlange aus dem Speicher in das Signal. */
  async read(): Promise<readonly QueueEntry[]> {
    const db = await this.open();
    const alle = db === null ? [] : ((await db.getAll(CACHE)) as QueueEntry[]);
    alle.sort((links, right) => links.erstelltAm.localeCompare(right.erstelltAm));
    this._eintraege.set(alle);
    return alle;
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    if (db === null) return;
    await db.delete(CACHE, id);
    await this.read();
  }

  /**
   * Sendet, was wartet, und gibt zurück, wie viele Einträge angekommen sind.
   * Der erste Fehlschlag bricht ab: ohne Netz scheitert auch der nächste, und
   * ein Eintrag, der beim Server liegt, darf nicht ein zweites Mal hin.
   */
  async send(): Promise<number> {
    let sent = 0;
    for (const entry of await this.read()) {
      try {
        await this.sendOne(entry);
      } catch {
        // Was nicht ankam, bleibt liegen und geht beim nächsten Versuch mit.
        break;
      }
      await this.remove(entry.id);
      sent += 1;
    }
    return sent;
  }

  private async sendOne(entry: QueueEntry): Promise<void> {
    if (entry.art === 'marker') {
      await firstValueFrom(this.api.createMarker(entry.body as MarkerInput));
      return;
    }
    if (entry.art === 'zone') {
      await firstValueFrom(this.api.createZone(entry.body as ZoneInput));
      return;
    }
    const find = await firstValueFrom(this.api.createFind(entry.body as FindInput));
    for (const [nummer, blob] of entry.fotos.entries()) {
      const file = new File([blob], `foto-${nummer + 1}.jpg`, { type: blob.type || 'image/jpeg' });
      await firstValueFrom(this.api.addPhoto(find.id, file));
    }
  }

  /**
   * Öffnet die Datenbank einmal je Sitzung. Ein privates Fenster kann
   * IndexedDB ganz abschalten; dann wirft schon der Aufruf, nicht erst das
   * Versprechen. Beide Wege enden hier in `null`.
   */
  private open(): Promise<IDBPDatabase | null> {
    this.db ??= this.create();
    return this.db;
  }

  private create(): Promise<IDBPDatabase | null> {
    try {
      return openDB(DB_NAME, DB_VERSION, {
        upgrade: (db) => {
          db.createObjectStore(CACHE, { keyPath: 'id' });
        },
      }).catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  }
}
