import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AnsichtDienst } from '../../core/layout/ansicht.service';
import { ManifestDienst } from '../../core/kacheln/manifest.service';
import { EbenenDienst } from '../../core/kacheln/ebenen.service';
import {
  ebenenOrdner,
  ebenenWoche,
  findeEbene,
  formatiereWert,
  passendeWoche,
  type Ebene,
  type EbenenManifest,
} from '../../core/kacheln/ebenen';
import {
  aktuelleWoche,
  balkenAnteile,
  findeWoche,
  kachelnAufStufe,
  wochenSchluessel,
  type ArtManifest,
  type ManifestWoche,
} from '../../core/kacheln/manifest';
import { sichtbareKacheln } from '../../map/kachel-raster';
import { DEUTSCHLAND, MAX_GRENZEN, ZOOM_MAX, ZOOM_MIN, stilFuer } from '../../map/hintergrund';
import type { Polster } from '../../map/map-adapter';
import { KARTE_ADAPTER, KARTE_ANBIETER, WERT_ARBEITER } from '../../map/karte.tokens';
import { WertProtokoll, artQuelle, wertVorlage } from '../../map/wert-protokoll';
import { VORHERSAGE_RAMPE } from '../../ui/ramp/rampe-farben';
import { ThemeService } from '../../core/theme/theme.service';
import {
  FloatingButtonComponent,
  NoteComponent,
  RASTEN_STANDARD,
  RampComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  TimelineComponent,
  rasteInPx,
  type Raste,
  type SegmentOption,
  type ZeitleisteWoche,
} from '../../ui';
import { EbenenBlattComponent } from './ebenen-blatt.component';
import { EbenenListeComponent } from './ebenen-liste.component';
import { DARSTELLUNGEN, KartenZustand, STANDARD_EBENE } from './karten-zustand';

/** Takt der Wiedergabe. 700 ms sind langsam genug, um eine Woche zu erkennen. */
const TAKT = 700;

/** So viele Wochen in jede Richtung werden vorgeladen. */
const VORLAUF = 2;

/** Nach dem Standort-Knopf: nah genug für einen Waldweg. */
const ZOOM_ORT = 11;

/** Die Kennung einer Ebene im Protokoll, damit sie nicht mit einer Art kollidiert. */
export function ebenenQuelleId(ebene: Ebene): string {
  return `ebene-${ebene.id}`;
}

/**
 * Der Reiter Karte: Hintergrund von OpenFreeMap, darüber die Wertkacheln von
 * Vorhersage und Eingabe-Ebene, darunter das Blatt mit Kopf, Zeitleiste und
 * Legende.
 */
@Component({
  selector: 'app-karte',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EbenenBlattComponent,
    EbenenListeComponent,
    FloatingButtonComponent,
    NoteComponent,
    RampComponent,
    SegmentedComponent,
    SheetComponent,
    SheetHeadComponent,
    TimelineComponent,
    TranslatePipe,
  ],
  providers: KARTE_ANBIETER,
  templateUrl: './karte.component.html',
  styleUrl: './karte.component.scss',
})
export class KarteComponent implements OnDestroy {
  private readonly flaeche = viewChild.required<ElementRef<HTMLElement>>('flaeche');
  private readonly adapter = inject(KARTE_ADAPTER);
  private readonly manifeste = inject(ManifestDienst);
  private readonly ebenenDienst = inject(EbenenDienst);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly ansicht = inject(AnsichtDienst);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly protokoll = new WertProtokoll(inject(WERT_ARBEITER));

  protected readonly zustand = inject(KartenZustand);
  protected readonly breit = this.ansicht.breit;

  private readonly manifest = signal<ArtManifest | null>(null);
  private readonly ebenen = signal<EbenenManifest | null>(null);
  private readonly bereit = signal(false);
  private uhr: ReturnType<typeof setInterval> | null = null;

  protected readonly spielt = signal(false);
  protected readonly ebenenOffen = signal(false);

  protected readonly zeigtEbene = computed(() => this.zustand.darstellung() === 'ebene');

  protected readonly woche = computed<ManifestWoche | null>(() => {
    const manifest = this.manifest();
    if (!manifest) return null;
    const gewaehlt = this.zustand.woche();
    return (gewaehlt !== null ? findeWoche(manifest, gewaehlt) : null) ?? aktuelleWoche(manifest);
  });

  /** Ohne Wahl in der Adresse steht die Ebene aus dem Konzeptbeispiel vorn. */
  protected readonly ebene = computed<Ebene | null>(() => {
    const manifest = this.ebenen();
    if (!manifest) return null;
    return (
      findeEbene(manifest, this.zustand.ebene()) ??
      findeEbene(manifest, STANDARD_EBENE) ??
      manifest.ebenen.at(0) ??
      null
    );
  });

  /** Die Woche, die die Ebene wirklich zeigt. Das Wetter endet vor der Prognose. */
  protected readonly ebenenWocheAktiv = computed(() => {
    const ebene = this.ebene();
    const woche = this.woche();
    if (!ebene || ebene.fest || !woche) return null;
    return passendeWoche(ebene, ebenenWoche(woche.jahr, woche.woche));
  });

  protected readonly leiste = computed<ZeitleisteWoche[]>(() => {
    const manifest = this.manifest();
    if (!manifest) return [];
    const anteile = balkenAnteile(manifest);
    return manifest.wochen.map((woche, i) => ({
      jahr: woche.jahr,
      woche: woche.woche,
      anteil: anteile[i],
      prognose: woche.prognose,
    }));
  });

  protected readonly artName = computed(() => this.i18n.translate(`art.${this.zustand.art()}`));

  /** Der Kopf nennt, was die Karte zeigt: die Art oder die Ebene. */
  protected readonly kopfTitel = computed(() =>
    this.zeigtEbene() ? (this.ebene()?.label ?? this.i18n.translate('darstellung.ebene')) : this.artName(),
  );

  protected readonly wochenText = computed(() => {
    const woche = this.woche();
    return woche ? this.i18n.translate('zeitleiste.woche', { woche: woche.woche, jahr: woche.jahr }) : '';
  });

  protected readonly prognoseHinweis = computed(() =>
    !this.zeigtEbene() && this.woche()?.prognose === true
      ? this.i18n.translate('karte.prognoseHinweis')
      : undefined,
  );

  /** Sagt unter der Zeitleiste, welche Woche die Ebene wirklich zeigt. */
  protected readonly ebenenHinweis = computed(() => {
    const ebene = this.ebene();
    if (!this.zeigtEbene() || !ebene) return null;
    if (ebene.fest) return this.i18n.translate('ebene.giltFuerAlleWochen');
    const eigene = this.ebenenWocheAktiv();
    const woche = this.woche();
    if (eigene === null || !woche || eigene === ebenenWoche(woche.jahr, woche.woche)) return null;
    return this.i18n.translate('ebene.andereWoche', {
      woche: Number(eigene.slice(5)),
      jahr: Number(eigene.slice(0, 4)),
    });
  });

  /** Eine feste Ebene kennt keine Woche; die Leiste tritt dann zurück. */
  protected readonly festeEbene = computed(() => this.zeigtEbene() && this.ebene()?.fest === true);

  protected readonly alleEbenen = computed(() => this.ebenen()?.ebenen ?? []);

  protected readonly rampenTitel = computed(() =>
    this.zeigtEbene() ? (this.ebene()?.label ?? '') : this.i18n.translate('karte.rampe'),
  );

  protected readonly rampeVon = computed(() => {
    const ebene = this.ebene();
    if (!this.zeigtEbene()) return this.i18n.translate('karte.rampeVon');
    return ebene ? formatiereWert(ebene.low, ebene, this.i18n.locale()) : '';
  });

  protected readonly rampeBis = computed(() => {
    const ebene = this.ebene();
    if (!this.zeigtEbene()) {
      return this.i18n.translate('karte.prozent', {
        wert: Math.round((this.manifest()?.top ?? 0) * 100),
      });
    }
    return ebene ? formatiereWert(ebene.high, ebene, this.i18n.locale()) : '';
  });

  protected readonly darstellungen = computed<SegmentOption[]>(() =>
    DARSTELLUNGEN.map((wert) => ({ wert, label: this.i18n.translate(`darstellung.${wert}`) })),
  );

  constructor() {
    this.adapter.waermeAuf();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((abfrage) => {
      this.zustand.uebernimm({
        art: abfrage.get('art'),
        kw: abfrage.get('kw'),
        darstellung: abfrage.get('darstellung'),
        ebene: abfrage.get('ebene'),
        deckkraft: abfrage.get('deckkraft'),
      });
    });

    effect(() => {
      void this.ladeManifest(this.zustand.art());
    });

    void this.ladeEbenen();

    // Der Stil folgt der Wahl, sonst dem Theme. Erst wenn die Karte steht.
    effect(() => {
      const stil = stilFuer(this.zustand.hintergrund(), this.theme.wirksam());
      if (this.bereit()) this.adapter.setzeStil(stil);
    });

    effect(() => {
      this.legeVorhersage();
    });

    effect(() => {
      this.legeEbene();
    });

    effect(() => {
      const deckkraft = this.zustand.deckkraft();
      const aufEbene = this.zeigtEbene();
      if (!this.bereit()) return;
      // Der Regler gilt der Ebene, die man gerade liest. Was darunter liegt,
      // bleibt voll deckend, sonst verschwände es mit.
      this.adapter.setzeDeckkraft('ebene', aufEbene ? deckkraft : 1);
      this.adapter.setzeDeckkraft('vorhersage', aufEbene ? 1 : deckkraft);
    });

    effect(() => {
      const raste = this.zustand.raste();
      const breit = this.breit();
      if (this.bereit()) this.adapter.setzePolster(this.polster(raste, breit));
    });

    afterNextRender(() => {
      void this.starteKarte();
    });
  }

  ngOnDestroy(): void {
    this.halteAn();
    this.adapter.zerstoere();
    this.protokoll.beende();
  }

  protected setzeRaste(raste: Raste): void {
    this.zustand.raste.set(raste);
  }

  protected setzeDarstellung(wert: string): void {
    const gewaehlt = DARSTELLUNGEN.find((darstellung) => darstellung === wert);
    if (!gewaehlt) return;
    this.zustand.darstellung.set(gewaehlt);
    this.schreibeAdresse();
  }

  protected waehleEbene(ebene: Ebene): void {
    this.zustand.ebene.set(ebene.id);
    this.schreibeAdresse();
  }

  protected setzeDeckkraft(wert: number): void {
    this.zustand.deckkraft.set(wert);
    this.schreibeAdresse();
  }

  protected waehleWoche(woche: { jahr: number; woche: number }): void {
    this.halteAn();
    this.zustand.woche.set(wochenSchluessel(woche));
    this.schreibeAdresse();
  }

  /** Eine Woche vor oder zurück, ohne über die Enden hinaus. */
  protected schritt(richtung: 1 | -1): void {
    const manifest = this.manifest();
    const woche = this.woche();
    if (!manifest || !woche) return;
    const jetzt = manifest.wochen.indexOf(woche);
    const ziel = Math.min(manifest.wochen.length - 1, Math.max(0, jetzt + richtung));
    if (ziel !== jetzt) this.waehleWoche(manifest.wochen[ziel]);
  }

  protected spielen(): void {
    if (this.spielt()) {
      this.halteAn();
      return;
    }
    this.spielt.set(true);
    this.uhr = setInterval(() => {
      const manifest = this.manifest();
      const woche = this.woche();
      if (!manifest || !woche) return;
      const naechste = manifest.wochen.indexOf(woche) + 1;
      if (naechste >= manifest.wochen.length) {
        this.halteAn();
        return;
      }
      this.zustand.woche.set(wochenSchluessel(manifest.wochen[naechste]));
      this.schreibeAdresse();
    }, TAKT);
  }

  protected zuDenArten(): void {
    void this.router.navigate(['/arten']);
  }

  /** Zentriert die Karte auf den eigenen Standort. */
  protected zumStandort(): void {
    navigator.geolocation.getCurrentPosition(
      (ort) => {
        this.adapter.zentriere([ort.coords.longitude, ort.coords.latitude], ZOOM_ORT);
      },
      () => {
        // Kein Standort ist kein Fehler der App: der Nutzer hat abgelehnt, oder
        // im Wald steht kein Signal. Ein Toast sagt es und lässt die Karte stehen.
        this.toasts.error(this.i18n.translate('karte.ortFehler'));
      },
    );
  }

  private halteAn(): void {
    if (this.uhr !== null) clearInterval(this.uhr);
    this.uhr = null;
    this.spielt.set(false);
  }

  private async ladeManifest(slug: string): Promise<void> {
    try {
      const manifest = await this.manifeste.hole(slug);
      this.protokoll.melde(artQuelle(manifest.slug, manifest.top, manifest.vorhanden));
      this.manifest.set(manifest);
      this.ladeUebersicht(manifest);
      this.schreibeAdresse();
    } catch {
      // Ohne Manifest bleibt die Hintergrundkarte stehen; das Blatt zeigt dann
      // keine Wochen. Ein Fehlerbild wäre hier nicht hilfreicher.
      this.manifest.set(null);
    }
  }

  private async ladeEbenen(): Promise<void> {
    try {
      this.ebenen.set(await this.ebenenDienst.hole());
      // Erst jetzt steht fest, welche Ebene gilt. Vorher trug die Adresse
      // höchstens eine Kennung, jetzt trägt sie die aufgelöste Ebene.
      this.schreibeAdresse();
    } catch {
      // Ohne `layers.json` bleibt die Darstellung Ebene leer. Vorhersage geht.
      this.ebenen.set(null);
    }
  }

  /**
   * Die groben Stufen der gewählten Woche, sofort nach dem Manifest.
   *
   * MapLibre ist an dieser Stelle noch nicht geladen. Wären die Kacheln erst
   * nach seinem Stil an der Reihe, käme die Vorhersage rund eine Sekunde nach
   * der Hintergrundkarte; so liegt sie schon im Speicher des Workers.
   */
  private ladeUebersicht(manifest: ArtManifest): void {
    const woche = this.woche();
    if (!woche) return;
    this.protokoll.vorladen(
      manifest.slug,
      [woche.kachelPfad],
      [...kachelnAufStufe(manifest, manifest.zoomVon), ...kachelnAufStufe(manifest, manifest.zoomVon + 1)],
    );
  }

  /** Die Vorhersage liegt unter der Ebene, wenn beide gefragt sind. */
  private legeVorhersage(): void {
    const manifest = this.manifest();
    const woche = this.woche();
    const sichtbar = !this.zeigtEbene() || this.zustand.vorhersageDarunter();
    if (!this.bereit() || !manifest || !woche) return;
    this.adapter.zeigeWert(
      'vorhersage',
      sichtbar ? wertVorlage(manifest.slug, woche.kachelPfad) : null,
      manifest.grenzen,
      manifest.zoomVon,
      manifest.zoomBis,
    );
    if (sichtbar) this.ladeNachbarn();
  }

  private legeEbene(): void {
    const manifest = this.ebenen();
    const ebene = this.ebene();
    const woche = this.woche();
    if (!this.bereit()) return;
    if (!this.zeigtEbene() || !manifest || !ebene) {
      this.adapter.zeigeWert('ebene', null, MAX_GRENZEN, ZOOM_MIN, ZOOM_MAX);
      return;
    }
    this.protokoll.melde({
      id: ebenenQuelleId(ebene),
      skala: { art: 'spanne', low: ebene.low, high: ebene.high },
      farben: VORHERSAGE_RAMPE,
      vorhanden: ebene.vorhanden,
    });
    const ordner = ebenenOrdner(ebene, woche ? ebenenWoche(woche.jahr, woche.woche) : null);
    this.adapter.zeigeWert(
      'ebene',
      ordner === null ? null : wertVorlage(ebenenQuelleId(ebene), ordner),
      manifest.grenzen,
      ebene.zoomVon,
      ebene.zoomBis,
    );
  }

  private async starteKarte(): Promise<void> {
    await this.adapter.starte(this.flaeche().nativeElement, {
      stil: stilFuer(this.zustand.hintergrund(), this.theme.wirksam()),
      zentrum: [10.4, 51.2],
      zoom: ZOOM_MIN,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      maxGrenzen: MAX_GRENZEN,
      protokoll: { name: 'wert', aufloesen: this.protokoll.aufloesen },
      kompakt: !this.breit(),
    });
    this.adapter.passeEin(DEUTSCHLAND, this.polster(this.zustand.raste(), this.breit()));
    this.adapter.beiBewegung(() => {
      this.ladeNachbarn();
    });
    this.bereit.set(true);
  }

  /**
   * Der freie Streifen der Karte. Die Karte rechnet ihre Mitte darauf, statt
   * hinter das Blatt zu zielen.
   */
  private polster(raste: Raste, breit: boolean): Polster {
    if (breit) return { top: 0, bottom: 0, left: 0, right: 0 };
    const hoehe = this.flaeche().nativeElement.clientHeight;
    return { top: 0, bottom: Math.round(rasteInPx(RASTEN_STANDARD[raste], hoehe)), left: 0, right: 0 };
  }

  private ladeNachbarn(): void {
    const manifest = this.manifest();
    const woche = this.woche();
    const sicht = this.adapter.ausschnitt();
    if (!manifest || !woche || !sicht) return;
    const jetzt = manifest.wochen.indexOf(woche);
    const nachbarn: string[] = [];
    const ebenenNachbarn: string[] = [];
    const ebene = this.ebene();
    for (let abstand = 1; abstand <= VORLAUF; abstand++) {
      for (const index of [jetzt + abstand, jetzt - abstand]) {
        const nachbar = manifest.wochen[index] as ManifestWoche | undefined;
        if (!nachbar) continue;
        nachbarn.push(nachbar.kachelPfad);
        if (this.zeigtEbene() && ebene && !ebene.fest) {
          const ordner = ebenenOrdner(ebene, ebenenWoche(nachbar.jahr, nachbar.woche));
          if (ordner !== null) ebenenNachbarn.push(ordner);
        }
      }
    }
    const kacheln = sichtbareKacheln(sicht.ausschnitt, sicht.zoom, manifest.zoomVon, manifest.zoomBis);
    this.protokoll.vorladen(manifest.slug, nachbarn, kacheln);
    if (ebene && ebenenNachbarn.length > 0) {
      this.protokoll.vorladen(ebenenQuelleId(ebene), ebenenNachbarn, kacheln);
    }
  }

  private schreibeAdresse(): void {
    const woche = this.woche();
    const adresse = this.zustand.adresse();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        art: adresse.art,
        kw: woche ? wochenSchluessel(woche) : null,
        darstellung: adresse.darstellung === 'vorhersage' ? null : adresse.darstellung,
        // Solange die Ebenen noch nicht da sind, bleibt die Kennung aus der
        // Adresse stehen; sonst löschte der erste Schreibvorgang den Deep Link.
        ebene: this.zeigtEbene() ? (this.ebene()?.id ?? this.zustand.ebene()) : null,
        deckkraft: adresse.deckkraft === 100 ? null : adresse.deckkraft,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
