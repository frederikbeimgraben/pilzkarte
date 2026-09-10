import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EintraegeApi, type Rechteck } from '../../core/api/eintraege.api';
import type {
  Fund,
  FundAenderung,
  FundEingabe,
  GeteilterFund,
  Marker,
  MarkerAenderung,
  MarkerEingabe,
  Zone,
  ZoneAenderung,
  ZoneEingabe,
} from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { Warteschlange } from '../../core/offline/warteschlange';

/** Was aus einem Speicherversuch geworden ist. */
export type Ablage = 'gespeichert' | 'wartet' | 'verworfen';

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
export class EintraegeZustand {
  private readonly api = inject(EintraegeApi);
  private readonly auth = inject(AuthService);
  private readonly warteschlange = inject(Warteschlange);

  private readonly _funde = signal<readonly Fund[]>([]);
  private readonly _marker = signal<readonly Marker[]>([]);
  private readonly _zonen = signal<readonly Zone[]>([]);
  private readonly _geteilte = signal<readonly GeteilterFund[]>([]);
  private readonly _laedt = signal(false);

  readonly funde = this._funde.asReadonly();
  readonly marker = this._marker.asReadonly();
  readonly zonen = this._zonen.asReadonly();
  /** Geteilte Funde im zuletzt gefragten Ausschnitt, auch fremde. */
  readonly geteilte = this._geteilte.asReadonly();
  readonly laedt = this._laedt.asReadonly();
  readonly wartende = this.warteschlange.eintraege;

  readonly angemeldet = this.auth.angemeldet;
  /** Der Name am eigenen Fund kommt aus dem Konto, nie aus einem Feld. */
  readonly melder = computed(() => this.auth.nutzer()?.name ?? null);

  /** Holt alles Eigene. Ohne Konto gibt es nichts zu holen. */
  async lade(): Promise<void> {
    await this.warteschlange.lies();
    if (!this.auth.angemeldet()) {
      this._funde.set([]);
      this._marker.set([]);
      this._zonen.set([]);
      return;
    }
    this._laedt.set(true);
    try {
      const [funde, marker, zonen] = await Promise.all([
        firstValueFrom(this.api.funde()),
        firstValueFrom(this.api.marker()),
        firstValueFrom(this.api.zonen()),
      ]);
      this._funde.set(funde.eintraege);
      this._marker.set(marker.eintraege);
      this._zonen.set(zonen.eintraege);
    } catch {
      // Ein Ausfall lässt stehen, was schon da ist. Der Toast des ApiClient
      // hat die Person bereits informiert.
    } finally {
      this._laedt.set(false);
    }
  }

  /** Geteilte Funde im Ausschnitt. Diese Route liest auch ohne Konto. */
  async ladeGeteilte(rechteck?: Rechteck): Promise<void> {
    try {
      const seite = await firstValueFrom(this.api.geteilteFunde(rechteck));
      this._geteilte.set(seite.eintraege);
    } catch {
      // Ohne Netz bleibt die Karte bei dem, was zuletzt kam.
    }
  }

  async speichereFund(eingabe: FundEingabe, fotos: readonly File[] = []): Promise<Ablage> {
    if (!(await this.auth.anmeldungAnfordern())) return this.stelleFundAn(eingabe, fotos);
    try {
      const fund = await firstValueFrom(this.api.fundAnlegen(eingabe));
      const fertig = await this.haengeFotosAn(fund, fotos);
      this._funde.update((alt) => [fertig, ...alt]);
      return 'gespeichert';
    } catch {
      return this.stelleFundAn(eingabe, fotos);
    }
  }

  async speichereMarker(eingabe: MarkerEingabe): Promise<Ablage> {
    if (!(await this.auth.anmeldungAnfordern())) return this.stelleMarkerAn(eingabe);
    try {
      const marker = await firstValueFrom(this.api.markerAnlegen(eingabe));
      this._marker.update((alt) => [marker, ...alt]);
      return 'gespeichert';
    } catch {
      return this.stelleMarkerAn(eingabe);
    }
  }

  async speichereZone(eingabe: ZoneEingabe): Promise<Ablage> {
    if (!(await this.auth.anmeldungAnfordern())) return this.stelleZoneAn(eingabe);
    try {
      const zone = await firstValueFrom(this.api.zoneAnlegen(eingabe));
      this._zonen.update((alt) => [zone, ...alt]);
      return 'gespeichert';
    } catch {
      return this.stelleZoneAn(eingabe);
    }
  }

  async aendereFund(id: string, aenderung: FundAenderung): Promise<boolean> {
    try {
      const fund = await firstValueFrom(this.api.fundAendern(id, aenderung));
      this._funde.update((alt) => alt.map((kandidat) => (kandidat.id === id ? fund : kandidat)));
      return true;
    } catch {
      return false;
    }
  }

  async aendereMarker(id: string, aenderung: MarkerAenderung): Promise<boolean> {
    try {
      const marker = await firstValueFrom(this.api.markerAendern(id, aenderung));
      this._marker.update((alt) => alt.map((kandidat) => (kandidat.id === id ? marker : kandidat)));
      return true;
    } catch {
      return false;
    }
  }

  async aendereZone(id: string, aenderung: ZoneAenderung): Promise<boolean> {
    try {
      const zone = await firstValueFrom(this.api.zoneAendern(id, aenderung));
      this._zonen.update((alt) => alt.map((kandidat) => (kandidat.id === id ? zone : kandidat)));
      return true;
    } catch {
      return false;
    }
  }

  async loescheFund(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.fundLoeschen(id));
      this._funde.update((alt) => alt.filter((kandidat) => kandidat.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  async loescheMarker(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.markerLoeschen(id));
      this._marker.update((alt) => alt.filter((kandidat) => kandidat.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  async loescheZone(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.zoneLoeschen(id));
      this._zonen.update((alt) => alt.filter((kandidat) => kandidat.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  /** Sendet, was wartet, und holt danach die eigenen Einträge neu. */
  async sendeWartende(): Promise<number> {
    if (!this.auth.angemeldet()) return 0;
    const gesendet = await this.warteschlange.sende();
    if (gesendet > 0) await this.lade();
    return gesendet;
  }

  private async stelleFundAn(koerper: FundEingabe, fotos: readonly File[]): Promise<Ablage> {
    return this.gestellt(await this.warteschlange.lege('fund', koerper, fotos));
  }

  private async stelleMarkerAn(koerper: MarkerEingabe): Promise<Ablage> {
    return this.gestellt(await this.warteschlange.lege('marker', koerper));
  }

  private async stelleZoneAn(koerper: ZoneEingabe): Promise<Ablage> {
    return this.gestellt(await this.warteschlange.lege('zone', koerper));
  }

  /**
   * Ohne IndexedDB gibt es keinen Platz für die Warteschlange. Dann ist der
   * Eintrag verloren, und die Oberfläche sagt es, statt Erfolg zu melden.
   */
  private gestellt(eintrag: unknown): Ablage {
    return eintrag === null ? 'verworfen' : 'wartet';
  }

  /**
   * Hängt die Fotos an den frisch angelegten Fund. Ein Foto, das nicht
   * durchgeht, kostet nicht den Fund: er steht dann eben mit weniger Bildern da.
   */
  private async haengeFotosAn(fund: Fund, fotos: readonly File[]): Promise<Fund> {
    let fertig = fund;
    for (const datei of fotos) {
      try {
        const foto = await firstValueFrom(this.api.fotoAnlegen(fund.id, datei));
        fertig = { ...fertig, fotos: [...fertig.fotos, foto] };
      } catch {
        break;
      }
    }
    return fertig;
  }
}
