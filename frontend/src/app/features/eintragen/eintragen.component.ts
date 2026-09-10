import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import type { Farbe } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import {
  ActionBarComponent,
  ActionRowComponent,
  ActionSheetComponent,
  CrosshairComponent,
  NoteComponent,
  SheetComponent,
  type RasteMass,
} from '../../ui';
import { EintraegeZustand, type Ablage } from '../eintraege/eintraege.zustand';
import { farbeHex } from '../eintraege/farben';
import { hektarText } from '../eintraege/formate';
import { BlattHoeheDirective } from '../karte/blatt-hoehe.directive';
import { KartenZustand } from '../karte/karten-zustand';
import { EintragenZustand, type Ort } from './eintragen.zustand';
import { FundFormularComponent, type FundAbgabe } from './fund-formular.component';
import { alsPolygon, ladeFlaechenrechner, type Flaechenrechner } from './flaeche';
import { ObjektFormularComponent, type ObjektWerte } from './objekt-formular.component';
import { ZONEN_ZEICHNER, type ZeichenSitzung } from './zonen-zeichner';

/** Blätter, die nur einen Satz und eine Fußleiste tragen, folgen dem Inhalt. */
const RASTEN_INHALT: readonly [RasteMass, RasteMass, RasteMass] = ['inhalt', 'inhalt', 'inhalt'];

/** Das Formular steht auf 150 von 844 px, so wie im Artboard `MeldenFormular`. */
const RASTEN_FORMULAR: readonly [RasteMass, RasteMass, RasteMass] = [0.82, 0.82, 0.82];

/**
 * Der Ablauf hinter dem Plus-Knopf über der Karte: Aktionsblatt, Fadenkreuz,
 * Formular (Artboards `KarteAktionen`, `MeldenOrt`, `MeldenFormular`,
 * `ZoneZeichnen`).
 *
 * Die Komponente liegt über der Karte und sperrt sie, sobald es nichts mehr
 * zu schieben gibt. Solange das Fadenkreuz steht, bleibt die Karte frei.
 */
@Component({
  selector: 'app-eintragen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ActionRowComponent,
    ActionSheetComponent,
    BlattHoeheDirective,
    CrosshairComponent,
    FundFormularComponent,
    NoteComponent,
    ObjektFormularComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './eintragen.component.html',
  styleUrl: './eintragen.component.scss',
})
export class EintragenComponent implements OnDestroy {
  private readonly adapter = inject(KARTE_ADAPTER);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly eintraege = inject(EintraegeZustand);
  private readonly karte = inject(KartenZustand);
  private readonly zeichne = inject(ZONEN_ZEICHNER);

  private readonly objektFormular = viewChild(ObjektFormularComponent);

  protected readonly zustand = inject(EintragenZustand);
  /** Der untere Rand des freien Streifens: dort steht das Fadenkreuz. */
  protected readonly ueberlagerung = this.karte.ueberlagerung;
  protected readonly rastenInhalt = RASTEN_INHALT;
  protected readonly rastenFormular = RASTEN_FORMULAR;

  private readonly rechner = signal<Flaechenrechner | null>(null);
  private sitzung: ZeichenSitzung | null = null;
  private sitzungLaeuft: Promise<ZeichenSitzung | null> | null = null;

  protected readonly speichert = signal(false);
  /** Die Farbe, in der die Zone gerade gezeichnet wird. */
  protected readonly zonenFarbe = signal<Farbe>('gruen');

  protected readonly flaecheHa = computed(() => {
    const rechne = this.rechner();
    const polygon = alsPolygon(this.zustand.ring());
    return rechne !== null && polygon !== null ? rechne(polygon) : 0;
  });

  protected readonly zeichenAnleitung = computed(() =>
    this.i18n.translate('zone.zeichnenAnleitung', {
      punkte: this.zustand.ring().length,
      flaeche: hektarText(this.flaecheHa(), this.i18n.locale()),
    }),
  );

  protected readonly flaecheText = computed(() =>
    this.i18n.translate('zone.flaeche', { flaeche: hektarText(this.flaecheHa(), this.i18n.locale()) }),
  );

  constructor() {
    // Terra Draw und Turf kommen erst, wenn eine Zone entsteht. Beide liegen in
    // eigenen Paketen und fehlen dem Erstpaket.
    effect(() => {
      const schritt = this.zustand.schritt();
      if (schritt !== 'zoneZeichnen' && schritt !== 'zoneFormular') {
        this.beendeSitzung();
        return;
      }
      void this.ruesteZone();
    });

    effect(() => {
      const ring = this.zustand.ring();
      this.sitzung?.zeigeRing(ring);
    });
  }

  ngOnDestroy(): void {
    this.beendeSitzung();
  }

  protected beginneFund(): void {
    this.zustand.beginneFund();
  }

  protected beginneMarker(): void {
    this.zustand.beginneMarker();
  }

  protected beginneZone(): void {
    this.zustand.beginneZone();
  }

  protected abbrechen(): void {
    this.zustand.beende();
  }

  /** Übernimmt den Ort unter dem Fadenkreuz. */
  protected uebernimmOrt(): void {
    const ort = this.mitte();
    if (ort === null) return;
    this.zustand.uebernimmOrt(ort);
  }

  protected setzeEckpunkt(): void {
    const ort = this.mitte();
    if (ort === null) return;
    this.zustand.setzeEckpunkt(ort);
  }

  protected entferneEckpunkt(): void {
    this.zustand.entferneLetztenEckpunkt();
  }

  protected schliesseZone(): void {
    if (!this.zustand.schliesseZone()) this.toasts.error(this.i18n.translate('zone.zuWenigPunkte'));
  }

  protected async speichereFund(abgabe: FundAbgabe): Promise<void> {
    this.speichert.set(true);
    try {
      this.melde(await this.eintraege.speichereFund(abgabe.eingabe, abgabe.fotos), 'melden');
    } finally {
      this.speichert.set(false);
    }
  }

  protected async speichereMarker(): Promise<void> {
    const werte = this.objektFormular()?.werte();
    const ort = this.zustand.ort();
    if (!werte || ort === null) return;
    this.speichert.set(true);
    try {
      const ablage = await this.eintraege.speichereMarker({
        name: werte.name,
        lat: ort[1],
        lon: ort[0],
        farbe: werte.farbe,
        notiz: werte.notiz,
        sichtbarkeit: werte.sichtbarkeit,
      });
      this.melde(ablage, 'marker');
    } finally {
      this.speichert.set(false);
    }
  }

  protected async speichereZone(): Promise<void> {
    const werte = this.objektFormular()?.werte();
    const polygon = alsPolygon(this.zustand.ring());
    if (!werte || polygon === null) return;
    this.speichert.set(true);
    try {
      const ablage = await this.eintraege.speichereZone({
        name: werte.name,
        polygon,
        farbe: werte.farbe,
        notiz: werte.notiz,
        sichtbarkeit: werte.sichtbarkeit,
      });
      this.melde(ablage, 'zone');
    } finally {
      this.speichert.set(false);
    }
  }

  /** Die Vorschau auf der Karte folgt der gewählten Farbe. */
  protected beiZonenWerten(werte: ObjektWerte): void {
    this.zonenFarbe.set(werte.farbe);
  }

  private melde(ablage: Ablage, bereich: 'melden' | 'marker' | 'zone'): void {
    if (ablage === 'verworfen') {
      this.toasts.error(this.i18n.translate('melden.verworfen'));
      return;
    }
    this.toasts.success(this.i18n.translate(`${bereich}.${ablage}`));
    this.zustand.beende();
  }

  private mitte(): Ort | null {
    const ort = this.adapter.mitte();
    if (ort === null) this.toasts.error(this.i18n.translate('eintragen.ortFehlt'));
    return ort;
  }

  /** Holt Turf und Terra Draw und legt den Ring auf die Karte. */
  private async ruesteZone(): Promise<void> {
    this.rechner.set(await ladeFlaechenrechner());
    const karte = this.adapter.rohkarte();
    if (karte === null || this.sitzungLaeuft !== null) return;
    this.sitzungLaeuft = this.zeichne(karte, farbeHex(this.zonenFarbe()));
    this.sitzung = await this.sitzungLaeuft;
    this.sitzung?.zeigeRing(this.zustand.ring());
  }

  private beendeSitzung(): void {
    this.sitzung?.beende();
    this.sitzung = null;
    this.sitzungLaeuft = null;
    this.karte.ueberlagerung.set(0);
  }
}
