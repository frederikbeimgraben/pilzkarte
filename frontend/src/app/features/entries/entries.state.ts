import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EntriesApi, type Rect } from '../../core/api/entries.api';
import type {
  Find,
  FindPatch,
  FindInput,
  SharedFind,
  Marker,
  MarkerPatch,
  MarkerInput,
  Zone,
  ZonePatch,
  ZoneInput,
} from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { Queue } from '../../core/offline/queue';

/** Was aus einem Speicherversuch geworden ist. */
export type SaveResult = 'gespeichert' | 'wartet' | 'verworfen';

/**
 * Die eigenen Einträge im Speicher.
 *
 * Der Zustand hängt an keiner Seite: Karte, Liste und Objekt-Blätter lesen
 * dieselben Signale, damit ein neuer Fund überall zugleich steht. Wer speichern
 * will, wird vorher nach der Anmeldung gefragt; wer sie ablehnt oder kein Netz
 * hat, dessen Eintrag geht in die Warteschlange und trägt in der Liste das
 * Kennzeichen „Übertragung ausstehend“.
 */
@Injectable({ providedIn: 'root' })
export class EntriesState {
  private readonly api = inject(EntriesApi);
  private readonly auth = inject(AuthService);
  private readonly queue = inject(Queue);

  private readonly _finds = signal<readonly Find[]>([]);
  private readonly _marker = signal<readonly Marker[]>([]);
  private readonly _zones = signal<readonly Zone[]>([]);
  private readonly _shared = signal<readonly SharedFind[]>([]);
  private readonly _loading = signal(false);

  readonly finds = this._finds.asReadonly();
  readonly marker = this._marker.asReadonly();
  readonly zones = this._zones.asReadonly();
  /** Geteilte Funde im zuletzt gefragten Ausschnitt, auch fremde. */
  readonly shared = this._shared.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly pendingEntries = this.queue.eintraege;

  readonly signedIn = this.auth.signedIn;
  /** Der Name am eigenen Fund kommt aus dem Konto, nie aus einem Feld. */
  readonly melder = computed(() => this.auth.user()?.name ?? null);

  /** Holt alles Eigene. Ohne Konto gibt es nichts zu holen. */
  async load(): Promise<void> {
    await this.queue.read();
    if (!this.auth.signedIn()) {
      this._finds.set([]);
      this._marker.set([]);
      this._zones.set([]);
      return;
    }
    this._loading.set(true);
    try {
      const [finds, marker, zones] = await Promise.all([
        firstValueFrom(this.api.finds()),
        firstValueFrom(this.api.marker()),
        firstValueFrom(this.api.zones()),
      ]);
      this._finds.set(finds.eintraege);
      this._marker.set(marker.eintraege);
      this._zones.set(zones.eintraege);
    } catch {
      // Ein Ausfall lässt stehen, was schon da ist. Der Toast des ApiClient
      // hat die Person bereits informiert.
    } finally {
      this._loading.set(false);
    }
  }

  /** Geteilte Funde im Ausschnitt. Diese Route liest auch ohne Konto. */
  async loadShared(rect?: Rect): Promise<void> {
    try {
      const page = await firstValueFrom(this.api.sharedFinds(rect));
      this._shared.set(page.eintraege);
    } catch {
      // Ohne Netz bleibt die Karte bei dem, was zuletzt kam.
    }
  }

  async saveFind(input: FindInput, fotos: readonly File[] = []): Promise<SaveResult> {
    if (!(await this.auth.requestSignIn())) return this.enqueueFind(input, fotos);
    try {
      const find = await firstValueFrom(this.api.createFind(input));
      const done = await this.attachPhotos(find, fotos);
      this._finds.update((alt) => [done, ...alt]);
      return 'gespeichert';
    } catch {
      return this.enqueueFind(input, fotos);
    }
  }

  async saveMarker(input: MarkerInput): Promise<SaveResult> {
    if (!(await this.auth.requestSignIn())) return this.enqueueMarker(input);
    try {
      const marker = await firstValueFrom(this.api.createMarker(input));
      this._marker.update((alt) => [marker, ...alt]);
      return 'gespeichert';
    } catch {
      return this.enqueueMarker(input);
    }
  }

  async saveZone(input: ZoneInput): Promise<SaveResult> {
    if (!(await this.auth.requestSignIn())) return this.enqueueZone(input);
    try {
      const zone = await firstValueFrom(this.api.createZone(input));
      this._zones.update((alt) => [zone, ...alt]);
      return 'gespeichert';
    } catch {
      return this.enqueueZone(input);
    }
  }

  async updateFind(id: string, patch: FindPatch): Promise<boolean> {
    try {
      const find = await firstValueFrom(this.api.patchFind(id, patch));
      this._finds.update((alt) => alt.map((candidate) => (candidate.id === id ? find : candidate)));
      return true;
    } catch {
      return false;
    }
  }

  async updateMarker(id: string, patch: MarkerPatch): Promise<boolean> {
    try {
      const marker = await firstValueFrom(this.api.patchMarker(id, patch));
      this._marker.update((alt) => alt.map((candidate) => (candidate.id === id ? marker : candidate)));
      return true;
    } catch {
      return false;
    }
  }

  async updateZone(id: string, patch: ZonePatch): Promise<boolean> {
    try {
      const zone = await firstValueFrom(this.api.patchZone(id, patch));
      this._zones.update((alt) => alt.map((candidate) => (candidate.id === id ? zone : candidate)));
      return true;
    } catch {
      return false;
    }
  }

  async deleteFind(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteFind(id));
      this._finds.update((alt) => alt.filter((candidate) => candidate.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  async deleteMarker(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteMarker(id));
      this._marker.update((alt) => alt.filter((candidate) => candidate.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  async deleteZone(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteZone(id));
      this._zones.update((alt) => alt.filter((candidate) => candidate.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  /** Sendet, was wartet, und holt danach die eigenen Einträge neu. */
  async sendPending(): Promise<number> {
    if (!this.auth.signedIn()) return 0;
    const sent = await this.queue.send();
    if (sent > 0) await this.load();
    return sent;
  }

  private async enqueueFind(body: FindInput, fotos: readonly File[]): Promise<SaveResult> {
    return this.queued(await this.queue.put('fund', body, fotos));
  }

  private async enqueueMarker(body: MarkerInput): Promise<SaveResult> {
    return this.queued(await this.queue.put('marker', body));
  }

  private async enqueueZone(body: ZoneInput): Promise<SaveResult> {
    return this.queued(await this.queue.put('zone', body));
  }

  /**
   * Ohne IndexedDB gibt es keinen Platz für die Warteschlange. Dann ist der
   * Eintrag verloren, und die Oberfläche sagt es, statt Erfolg zu melden.
   */
  private queued(entry: unknown): SaveResult {
    return entry === null ? 'verworfen' : 'wartet';
  }

  /**
   * Hängt die Fotos an den frisch angelegten Fund. Ein Foto, das nicht
   * durchgeht, kostet nicht den Fund: er steht dann eben mit weniger Bildern da.
   */
  private async attachPhotos(find: Find, fotos: readonly File[]): Promise<Find> {
    let done = find;
    for (const file of fotos) {
      try {
        const photo = await firstValueFrom(this.api.addPhoto(find.id, file));
        done = { ...done, fotos: [...done.fotos, photo] };
      } catch {
        break;
      }
    }
    return done;
  }
}
