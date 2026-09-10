import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
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
  histogrammFuer,
  passendeWoche,
  type Ebene,
  type EbenenManifest,
} from '../../core/kacheln/ebenen';
import { ebeneAusArt } from '../../core/kacheln/art-als-ebene';
import { VORHERSAGE_SLUGS } from '../../core/kacheln/kachel-pfade';
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
import { WertProtokoll, artQuelle, wertVorlage, type KombiQuellenTeil } from '../../map/wert-protokoll';
import { VORHERSAGE_RAMPE } from '../../ui/ramp/rampe-farben';
import type { KombiRegel } from '../../map/wert-farben';
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
import { FaktorBlattComponent } from './faktor-blatt.component';
import { FaktorWaehlenComponent } from './faktor-waehlen.component';
import { KombinationComponent } from './kombination.component';
import { grenzeFuer, kodiereFaktoren, kombiSchluessel, ersetzeFaktor, type Faktor } from './faktoren';
import { EbenenListeComponent } from './ebenen-liste.component';
import { DARSTELLUNGEN, KartenZustand, STANDARD_EBENE } from './karten-zustand';

/** Takt der Wiedergabe. 700 ms sind langsam genug, um eine Woche zu erkennen. */
const TAKT = 700;

/** So viele Wochen in jede Richtung werden vorgeladen. */
const VORLAUF = 2;

/** Nach dem Standort-Knopf: nah genug für einen Waldweg. */
const ZOOM_ORT = 11;

/** Die Kennung der zusammengesetzten Quelle im Protokoll. */
const KOMBI_QUELLE = 'kombi';

/** British Racing Green, falls das Theme keine Farbe hergibt. */
const SCHNITT_ERSATZ = '#004225';

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
    FaktorBlattComponent,
    FaktorWaehlenComponent,
    KombinationComponent,
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

  /**
   * Nur die Zeichenfläche, ohne Blatt und Knöpfe. So steht die Karte am
   * Rechner neben einem anderen Reiter, ohne dessen Spalte zu belegen und ohne
   * unsichtbare Ziele in die Tastaturreihenfolge zu hängen.
   */
  readonly nurFlaeche = input(false);

  protected readonly zustand = inject(KartenZustand);
  protected readonly breit = this.ansicht.breit;

  /**
   * Nur die Karte, die gerade der Reiter ist, schreibt und liest die Adresse.
   * Sonst trüge der Reiter Arten die Abfragewerte der Karte, und ein Wechsel
   * dorthin setzte die Karte auf ihre Vorgaben zurück.
   */
  protected readonly fuehrtAdresse = computed(() => !this.nurFlaeche());

  private readonly manifest = signal<ArtManifest | null>(null);
  private readonly ebenen = signal<EbenenManifest | null>(null);
  private readonly bereit = signal(false);
  private uhr: ReturnType<typeof setInterval> | null = null;

  private readonly artEbenen = signal<ReadonlyMap<string, Ebene>>(new Map());

  protected readonly spielt = signal(false);
  protected readonly ebenenOffen = signal(false);
  /** Der Faktor, den der Screen `Faktor` gerade bearbeitet. */
  protected readonly offenerFaktor = signal<Faktor | null>(null);
  protected readonly waehltFaktor = signal(false);

  protected readonly zeigtEbene = computed(() => this.zustand.darstellung() === 'ebene');
  protected readonly zeigtKombination = computed(() => this.zustand.darstellung() === 'kombination');

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

  /** Jede Quelle, die ein Faktor nennen kann: die Ebenen und die Arten. */
  protected readonly faktorQuellen = computed<ReadonlyMap<string, Ebene>>(() => {
    const alle = new Map<string, Ebene>(this.artEbenen());
    for (const ebene of this.ebenen()?.ebenen ?? []) alle.set(ebene.id, ebene);
    return alle;
  });

  protected readonly wochenSchluesselAktiv = computed(() => {
    const woche = this.woche();
    return woche ? ebenenWoche(woche.jahr, woche.woche) : null;
  });

  /** Die Quelle, die der Faktor-Screen gerade zeigt. */
  protected readonly faktorEbene = computed<Ebene | null>(() => {
    const faktor = this.offenerFaktor();
    return faktor ? (this.faktorQuellen().get(faktor.quelle) ?? null) : null;
  });

  protected readonly faktorHistogramm = computed(() => {
    const ebene = this.faktorEbene();
    return ebene ? histogrammFuer(ebene, this.wochenSchluesselAktiv()) : null;
  });

  protected readonly faktorZeitbezug = computed(() => {
    const ebene = this.faktorEbene();
    if (!ebene) return '';
    return ebene.fest ? this.i18n.translate('faktor.konstant') : this.wochenText();
  });

  protected readonly vergebeneQuellen = computed(
    () => new Set(this.zustand.faktoren().map((faktor) => faktor.quelle)),
  );

  protected readonly artenAlsEbenen = computed(() => [...this.artEbenen().values()]);

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
  protected readonly kopfTitel = computed(() => {
    if (this.zeigtKombination()) return this.i18n.translate('darstellung.kombination');
    if (this.zeigtEbene()) return this.ebene()?.label ?? this.i18n.translate('darstellung.ebene');
    return this.artName();
  });

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

  protected readonly rampenTitel = computed(() => {
    if (this.zeigtKombination()) return this.i18n.translate('kombination.rampe');
    return this.zeigtEbene() ? (this.ebene()?.label ?? '') : this.i18n.translate('karte.rampe');
  });

  protected readonly rampeVon = computed(() => {
    const ebene = this.ebene();
    if (this.zeigtKombination()) return this.i18n.translate('karte.rampeVon');
    if (!this.zeigtEbene()) return this.i18n.translate('karte.rampeVon');
    return ebene ? formatiereWert(ebene.low, ebene, this.i18n.locale()) : '';
  });

  protected readonly rampeBis = computed(() => {
    const ebene = this.ebene();
    if (this.zeigtKombination()) return this.i18n.translate('karte.prozent', { wert: 100 });
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
      if (!this.fuehrtAdresse()) return;
      this.zustand.uebernimm({
        art: abfrage.get('art'),
        kw: abfrage.get('kw'),
        darstellung: abfrage.get('darstellung'),
        ebene: abfrage.get('ebene'),
        deckkraft: abfrage.get('deckkraft'),
        regel: abfrage.get('regel'),
        f: abfrage.get('f'),
      });
    });

    // Wird die Karte wieder zum Reiter, trägt die Adresse ihren Zustand erneut.
    // Ein Link mit eigenen Werten bleibt unangetastet; den liest der Abschnitt
    // darüber, und er käme sonst unter die Räder.
    effect(() => {
      if (!this.fuehrtAdresse()) return;
      untracked(() => {
        if (this.route.snapshot.queryParamMap.keys.length === 0) this.schreibeAdresse();
      });
    });

    effect(() => {
      void this.ladeManifest(this.zustand.art());
    });

    void this.ladeEbenen();

    effect(() => {
      if (this.zeigtKombination()) void this.ladeArten();
    });

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

  protected setzeRegel(regel: KombiRegel): void {
    this.zustand.regel.set(regel);
    this.schreibeAdresse();
  }

  protected schalteFaktor(wahl: { faktor: Faktor; aktiv: boolean }): void {
    this.zustand.faktoren.set(ersetzeFaktor(this.zustand.faktoren(), { ...wahl.faktor, aktiv: wahl.aktiv }));
    this.schreibeAdresse();
  }

  protected oeffneFaktor(faktor: Faktor): void {
    this.offenerFaktor.set(faktor);
  }

  protected uebernimmFaktor(faktor: Faktor): void {
    this.zustand.faktoren.set(ersetzeFaktor(this.zustand.faktoren(), faktor));
    this.offenerFaktor.set(null);
    this.schreibeAdresse();
  }

  protected entferneFaktor(faktor: Faktor): void {
    this.zustand.faktoren.set(this.zustand.faktoren().filter((eintrag) => eintrag.quelle !== faktor.quelle));
    this.offenerFaktor.set(null);
    this.schreibeAdresse();
  }

  /** Eine neue Quelle beginnt mit der oberen Hälfte ihrer Skala. */
  protected waehleQuelle(ebene: Ebene): void {
    const mitte = ebene.low + (ebene.high - ebene.low) / 2;
    const faktor: Faktor = { quelle: ebene.id, bedingung: 'ueber', von: mitte, bis: 0, aktiv: true };
    this.zustand.faktoren.set(ersetzeFaktor(this.zustand.faktoren(), faktor));
    this.waehltFaktor.set(false);
    this.offenerFaktor.set(faktor);
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

  /**
   * Die Manifeste aller Vorhersage-Arten, damit eine Art als Faktor taugt.
   * Erst wenn die Kombination aufgeht: elf Manifeste sind zusammen so groß wie
   * eine Kachel, aber niemand braucht sie auf der Vorhersage.
   */
  private async ladeArten(): Promise<void> {
    if (this.artEbenen().size > 0) return;
    const geladen = await Promise.all(
      VORHERSAGE_SLUGS.map(async (slug) => {
        try {
          return await this.manifeste.hole(slug);
        } catch {
          return null;
        }
      }),
    );
    const alle = new Map<string, Ebene>();
    for (const manifest of geladen) {
      if (manifest) alle.set(manifest.slug, ebeneAusArt(manifest, this.artNameVon(manifest.slug)));
    }
    this.artEbenen.set(alle);
  }

  private artNameVon(slug: string): string {
    const bekannt = VORHERSAGE_SLUGS.find((eintrag) => eintrag === slug);
    return bekannt ? this.i18n.translate(`art.${bekannt}`) : slug;
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
    // Die Kombination hängt an keiner Art; dort liegt keine Vorhersage darunter.
    const sichtbar =
      this.zustand.darstellung() === 'vorhersage' || (this.zeigtEbene() && this.zustand.vorhersageDarunter());
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

  /**
   * Die obere Wertebene. Sie zeigt die Ebene, die Kombination oder, solange
   * der Faktor-Screen offen ist, die Quelle dieses Faktors: was man einstellt,
   * soll man auch sehen.
   */
  private legeEbene(): void {
    const manifest = this.ebenen();
    if (!this.bereit()) return;
    const inArbeit = this.faktorEbene();
    if (inArbeit && manifest) {
      this.legeQuelle(inArbeit, manifest);
      return;
    }
    if (this.zeigtKombination()) {
      this.legeKombination();
      return;
    }
    const ebene = this.ebene();
    if (!this.zeigtEbene() || !manifest || !ebene) {
      this.adapter.zeigeWert('ebene', null, MAX_GRENZEN, ZOOM_MIN, ZOOM_MAX);
      return;
    }
    this.legeQuelle(ebene, manifest);
  }

  private legeQuelle(ebene: Ebene, manifest: EbenenManifest): void {
    this.protokoll.melde({
      id: ebenenQuelleId(ebene),
      skala: { art: 'spanne', low: ebene.low, high: ebene.high },
      farben: VORHERSAGE_RAMPE,
      vorhanden: ebene.vorhanden,
    });
    const ordner = ebenenOrdner(ebene, this.wochenSchluesselAktiv());
    this.adapter.zeigeWert(
      'ebene',
      ordner === null ? null : wertVorlage(ebenenQuelleId(ebene), ordner),
      manifest.grenzen,
      ebene.zoomVon,
      ebene.zoomBis,
    );
  }

  /**
   * Die Kombination als eine zusammengesetzte Quelle. Der Schlüssel im Ordner
   * ändert sich mit jeder Bedingung; sonst zeigte MapLibre die Kacheln der
   * vorigen Regel weiter.
   */
  private legeKombination(): void {
    const manifest = this.ebenen();
    const quellen = this.faktorQuellen();
    const woche = this.wochenSchluesselAktiv();
    const teile: KombiQuellenTeil[] = [];
    let zoomVon = ZOOM_MIN;
    let zoomBis = ZOOM_MAX;
    for (const faktor of this.zustand.faktoren()) {
      const ebene = quellen.get(faktor.quelle);
      if (!faktor.aktiv || !ebene) continue;
      const ordner = ebenenOrdner(ebene, woche);
      if (ordner === null) continue;
      teile.push({ ordner, grenze: grenzeFuer(faktor, ebene), vorhanden: ebene.vorhanden });
      zoomVon = Math.max(zoomVon, ebene.zoomVon);
      zoomBis = Math.min(zoomBis, ebene.zoomBis);
    }
    if (!manifest || teile.length === 0 || zoomBis < zoomVon) {
      this.adapter.zeigeWert('ebene', null, MAX_GRENZEN, ZOOM_MIN, ZOOM_MAX);
      return;
    }
    const regel = this.zustand.regel();
    this.protokoll.meldeKombi({
      id: KOMBI_QUELLE,
      regel,
      farben: regel === 'schnitt' ? [this.schnittFarbe()] : VORHERSAGE_RAMPE,
      teile,
    });
    const schluessel = kombiSchluessel([
      regel,
      kodiereFaktoren(this.zustand.faktoren()),
      woche ?? 'fest',
      this.theme.wirksam(),
    ]);
    this.adapter.zeigeWert(
      'ebene',
      wertVorlage(KOMBI_QUELLE, schluessel),
      manifest.grenzen,
      zoomVon,
      zoomBis,
    );
  }

  /**
   * Die Farbe der Schnittmenge kommt aus dem Theme: der Worker malt Daten,
   * aber diese eine Farbe ist die Primärfarbe der App und muss im dunklen
   * Bild anders liegen als im hellen.
   */
  private schnittFarbe(): string {
    const wert = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    return /^#[0-9a-f]{6}$/i.test(wert) ? wert : SCHNITT_ERSATZ;
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
    if (!this.fuehrtAdresse()) return;
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
        regel: this.zeigtKombination() ? adresse.regel : null,
        f: this.zeigtKombination() ? adresse.f : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
