import { Injectable, inject, signal } from '@angular/core';
import { openDB, type IDBPDatabase } from 'idb';
import { firstValueFrom } from 'rxjs';
import { EintraegeApi } from '../api/eintraege.api';
import type { FundEingabe, MarkerEingabe, ZoneEingabe } from '../api/models';

/** Was in der Warteschlange liegen kann. */
export type WarteArt = 'fund' | 'marker' | 'zone';

/** Die Eingabe, die zu einer Art gehört. */
export interface WarteKoerper {
  fund: FundEingabe;
  marker: MarkerEingabe;
  zone: ZoneEingabe;
}

/**
 * Ein Eintrag, der noch nicht beim Server liegt. Fotos liegen als Blob daneben,
 * weil eine Datei den Neustart des Browsers nicht überlebt.
 */
export interface WarteEintrag<A extends WarteArt = WarteArt> {
  id: string;
  art: A;
  koerper: WarteKoerper[A];
  fotos: Blob[];
  erstelltAm: string;
}

/** Name und Fassung der Datenbank. F1 baut denselben Speicher aus. */
const DB_NAME = 'pilzkarte';
const DB_FASSUNG = 1;
const SPEICHER = 'warteschlange';

/**
 * Die Warteschlange für Einträge ohne Verbindung oder ohne Konto.
 *
 * Sie kann drei Dinge: anlegen, auflisten und später senden. Alles Weitere —
 * Wiederholung mit Abstand, Hintergrund-Synchronisierung, Aufräumen — kommt in
 * F1. Ohne IndexedDB (privates Fenster, gesperrter Speicher) bleibt sie leer,
 * statt den Eintrag zu verlieren: der Aufrufer erfährt es am Rückgabewert.
 */
@Injectable({ providedIn: 'root' })
export class Warteschlange {
  private readonly api = inject(EintraegeApi);
  private db: Promise<IDBPDatabase | null> | null = null;

  private readonly _eintraege = signal<readonly WarteEintrag[]>([]);

  /** Was gerade wartet. Die Liste zeigt diese Einträge mit Badge. */
  readonly eintraege = this._eintraege.asReadonly();

  /** Legt einen Eintrag ab und gibt ihn zurück, oder `null` ohne Speicher. */
  async lege<A extends WarteArt>(
    art: A,
    koerper: WarteKoerper[A],
    fotos: readonly Blob[] = [],
  ): Promise<WarteEintrag<A> | null> {
    const eintrag: WarteEintrag<A> = {
      id: crypto.randomUUID(),
      art,
      koerper,
      fotos: [...fotos],
      erstelltAm: new Date().toISOString(),
    };
    const db = await this.oeffne();
    if (db === null) return null;
    await db.put(SPEICHER, eintrag);
    await this.lies();
    return eintrag;
  }

  /** Liest die Warteschlange aus dem Speicher in das Signal. */
  async lies(): Promise<readonly WarteEintrag[]> {
    const db = await this.oeffne();
    const alle = db === null ? [] : ((await db.getAll(SPEICHER)) as WarteEintrag[]);
    alle.sort((links, rechts) => links.erstelltAm.localeCompare(rechts.erstelltAm));
    this._eintraege.set(alle);
    return alle;
  }

  async entferne(id: string): Promise<void> {
    const db = await this.oeffne();
    if (db === null) return;
    await db.delete(SPEICHER, id);
    await this.lies();
  }

  /**
   * Sendet, was wartet, und gibt zurück, wie viele Einträge angekommen sind.
   * Der erste Fehlschlag bricht ab: ohne Netz scheitert auch der nächste, und
   * ein Eintrag, der beim Server liegt, darf nicht ein zweites Mal hin.
   */
  async sende(): Promise<number> {
    let gesendet = 0;
    for (const eintrag of await this.lies()) {
      try {
        await this.sendeEinen(eintrag);
      } catch {
        // Was nicht ankam, bleibt liegen und geht beim nächsten Versuch mit.
        break;
      }
      await this.entferne(eintrag.id);
      gesendet += 1;
    }
    return gesendet;
  }

  private async sendeEinen(eintrag: WarteEintrag): Promise<void> {
    if (eintrag.art === 'marker') {
      await firstValueFrom(this.api.markerAnlegen(eintrag.koerper as MarkerEingabe));
      return;
    }
    if (eintrag.art === 'zone') {
      await firstValueFrom(this.api.zoneAnlegen(eintrag.koerper as ZoneEingabe));
      return;
    }
    const fund = await firstValueFrom(this.api.fundAnlegen(eintrag.koerper as FundEingabe));
    for (const [nummer, blob] of eintrag.fotos.entries()) {
      const datei = new File([blob], `foto-${nummer + 1}.jpg`, { type: blob.type || 'image/jpeg' });
      await firstValueFrom(this.api.fotoAnlegen(fund.id, datei));
    }
  }

  /**
   * Öffnet die Datenbank einmal je Sitzung. Ein privates Fenster kann
   * IndexedDB ganz abschalten; dann wirft schon der Aufruf, nicht erst das
   * Versprechen. Beide Wege enden hier in `null`.
   */
  private oeffne(): Promise<IDBPDatabase | null> {
    this.db ??= this.baue();
    return this.db;
  }

  private baue(): Promise<IDBPDatabase | null> {
    try {
      return openDB(DB_NAME, DB_FASSUNG, {
        upgrade: (db) => {
          db.createObjectStore(SPEICHER, { keyPath: 'id' });
        },
      }).catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  }
}
