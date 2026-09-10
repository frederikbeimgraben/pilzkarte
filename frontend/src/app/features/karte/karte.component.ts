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
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AnsichtDienst } from '../../core/layout/ansicht.service';
import { ManifestDienst } from '../../core/kacheln/manifest.service';
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
import { DEUTSCHLAND, HINTERGRUND, MAX_GRENZEN, ZOOM_MAX, ZOOM_MIN } from '../../map/hintergrund';
import { KARTE_ADAPTER, WERT_ARBEITER, KARTE_ANBIETER } from '../../map/karte.tokens';
import { WertProtokoll, wertVorlage } from '../../map/wert-protokoll';
import { ThemeService } from '../../core/theme/theme.service';
import {
  NoteComponent,
  RampComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  TimelineComponent,
  RASTEN_STANDARD,
  rasteInPx,
  type Raste,
  type SegmentOption,
  type ZeitleisteWoche,
} from '../../ui';
import { DARSTELLUNGEN, KartenZustand } from './karten-zustand';

/** Takt der Wiedergabe. 700 ms sind langsam genug, um eine Woche zu erkennen. */
const TAKT = 700;

/** So viele Wochen in jede Richtung werden vorgeladen. */
const VORLAUF = 2;

/**
 * Der Reiter Karte: Hintergrund von OpenFreeMap, darüber die Wertkacheln der
 * gewählten Art und Woche, darunter das Blatt mit Kopf, Zeitleiste und Legende.
 */
@Component({
  selector: 'app-karte',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly ansicht = inject(AnsichtDienst);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly protokoll = new WertProtokoll(inject(WERT_ARBEITER));

  protected readonly zustand = inject(KartenZustand);
  protected readonly breit = this.ansicht.breit;

  private readonly manifest = signal<ArtManifest | null>(null);
  private readonly bereit = signal(false);
  private uhr: ReturnType<typeof setInterval> | null = null;

  protected readonly spielt = signal(false);

  protected readonly woche = computed<ManifestWoche | null>(() => {
    const manifest = this.manifest();
    if (!manifest) return null;
    const gewaehlt = this.zustand.woche();
    return (gewaehlt !== null ? findeWoche(manifest, gewaehlt) : null) ?? aktuelleWoche(manifest);
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

  protected readonly wochenText = computed(() => {
    const woche = this.woche();
    return woche ? this.i18n.translate('zeitleiste.woche', { woche: woche.woche, jahr: woche.jahr }) : '';
  });

  protected readonly prognoseHinweis = computed(() =>
    this.woche()?.prognose === true ? this.i18n.translate('karte.prognoseHinweis') : undefined,
  );

  /** Der Höchstwert der Art als Prozent, wie ihn die Legende nennt. */
  protected readonly rampeBis = computed(() =>
    this.i18n.translate('karte.prozent', { wert: Math.round((this.manifest()?.top ?? 0) * 100) }),
  );

  protected readonly darstellungen = computed<SegmentOption[]>(() =>
    DARSTELLUNGEN.map((wert) => ({ wert, label: this.i18n.translate(`darstellung.${wert}`) })),
  );

  constructor() {
    this.adapter.waermeAuf();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((abfrage) => {
      this.zustand.uebernimm(abfrage.get('art'), abfrage.get('kw'), abfrage.get('ansicht'));
    });

    effect(() => {
      void this.ladeManifest(this.zustand.art());
    });

    // Der Stil folgt dem Theme. Erst wenn die Karte steht, sonst käme der
    // Wechsel vor der Karte an.
    effect(() => {
      const stil = HINTERGRUND[this.theme.wirksam()];
      if (this.bereit()) this.adapter.setzeStil(stil);
    });

    effect(() => {
      const manifest = this.manifest();
      const woche = this.woche();
      if (!this.bereit() || !manifest || !woche) return;
      this.adapter.zeigeWert(
        wertVorlage(manifest.slug, woche.kachelPfad),
        manifest.grenzen,
        manifest.zoomVon,
        manifest.zoomBis,
      );
      this.ladeNachbarn();
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
    if (gewaehlt) this.zustand.darstellung.set(gewaehlt);
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

  private halteAn(): void {
    if (this.uhr !== null) clearInterval(this.uhr);
    this.uhr = null;
    this.spielt.set(false);
  }

  private async ladeManifest(slug: string): Promise<void> {
    try {
      const manifest = await this.manifeste.hole(slug);
      this.protokoll.merkeArt(manifest);
      this.manifest.set(manifest);
      this.ladeUebersicht(manifest);
      this.schreibeAdresse();
    } catch {
      // Ohne Manifest bleibt die Hintergrundkarte stehen; das Blatt zeigt dann
      // keine Wochen. Ein Fehlerbild wäre hier nicht hilfreicher.
      this.manifest.set(null);
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

  private async starteKarte(): Promise<void> {
    await this.adapter.starte(this.flaeche().nativeElement, {
      stil: HINTERGRUND[this.theme.wirksam()],
      zentrum: [10.4, 51.2],
      zoom: ZOOM_MIN,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      maxGrenzen: MAX_GRENZEN,
      protokoll: { name: 'wert', aufloesen: this.protokoll.aufloesen },
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
  private polster(
    raste: Raste,
    breit: boolean,
  ): { top: number; bottom: number; left: number; right: number } {
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
    for (let abstand = 1; abstand <= VORLAUF; abstand++) {
      for (const index of [jetzt + abstand, jetzt - abstand]) {
        const nachbar = manifest.wochen[index] as ManifestWoche | undefined;
        if (nachbar) nachbarn.push(nachbar.kachelPfad);
      }
    }
    this.protokoll.vorladen(
      manifest.slug,
      nachbarn,
      sichtbareKacheln(sicht.ausschnitt, sicht.zoom, manifest.zoomVon, manifest.zoomBis),
    );
  }

  private schreibeAdresse(): void {
    const woche = this.woche();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { art: this.zustand.art(), kw: woche ? wochenSchluessel(woche) : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
