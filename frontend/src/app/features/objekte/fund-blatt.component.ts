import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { BadgeComponent, CardComponent, DialogComponent, ToastService } from '@stupa-makers/ui-kit';
import type { Fund } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ManifestDienst } from '../../core/kacheln/manifest.service';
import { aktuelleWoche, findeWoche, type ManifestWoche } from '../../core/kacheln/manifest';
import { wertAmPunkt } from '../../core/kacheln/wert-am-punkt';
import { ActionBarComponent, MetricRowComponent, NoteComponent } from '../../ui';
import { ArtenZustand } from '../arten/arten.zustand';
import { EintraegeZustand } from '../eintraege/eintraege.zustand';
import { langesDatum } from '../eintraege/formate';
import { FundFormularComponent, type FundAbgabe } from '../eintragen/fund-formular.component';
import { KartenZustand } from '../karte/karten-zustand';
import { FotoGalerieComponent } from './foto-galerie.component';

/**
 * Das Objekt-Blatt eines Fundes (Artboard `Fund`).
 *
 * Die Kennzahl darunter nennt Art, Woche und Ort: sie kommt aus derselben
 * Wertkachel, die die Karte färbt, an genau dem Punkt des Fundes.
 */
@Component({
  selector: 'app-fund-blatt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    CardComponent,
    DialogComponent,
    FotoGalerieComponent,
    FundFormularComponent,
    MetricRowComponent,
    NoteComponent,
    TranslatePipe,
  ],
  templateUrl: './fund-blatt.component.html',
  styleUrl: './fund-blatt.component.scss',
})
export class FundBlattComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(ArtenZustand);
  private readonly eintraege = inject(EintraegeZustand);
  private readonly karte = inject(KartenZustand);
  private readonly manifeste = inject(ManifestDienst);

  readonly fund = input.required<Fund>();

  /** „Auf der Karte anzeigen“: der Ort, zu dem die Karte fahren soll. */
  readonly zeigeAufKarte = output<readonly [number, number]>();
  readonly geschlossen = output();

  protected readonly bearbeitet = signal(false);
  protected readonly loeschFrage = signal(false);
  protected readonly beschaeftigt = signal(false);
  private readonly woche = signal<ManifestWoche | null>(null);
  private readonly wert = signal<number | null>(null);

  protected readonly art = computed(() => {
    const slug = this.fund().artSlug;
    return (this.arten.liste()?.arten ?? []).find((kandidat) => kandidat.slug === slug) ?? null;
  });

  protected readonly artName = computed(() => this.art()?.name ?? this.fund().artSlug);
  protected readonly geteilt = computed(() => this.fund().sichtbarkeit === 'geteilt');
  protected readonly ort = computed<readonly [number, number]>(() => [this.fund().lon, this.fund().lat]);

  protected readonly unterzeile = computed(() => {
    const fund = this.fund();
    const datum = langesDatum(fund.datum, this.i18n.locale());
    const melder = this.eintraege.melder() ?? '';
    if (fund.anzahl === null) return this.i18n.translate('fund.unterOhneAnzahl', { datum, melder });
    return this.i18n.translate('fund.unter', {
      datum,
      anzahl: this.i18n.translate('fund.stueck', { anzahl: fund.anzahl }),
      melder,
    });
  });

  /** „Steinpilz, KW 40 · 2025, je Begehung“ — jede Zahl nennt ihren Bezug. */
  protected readonly wertBezug = computed(() => {
    const woche = this.woche();
    if (woche === null) return '';
    return this.i18n.translate('fund.vorhersageUnter', {
      art: this.artName(),
      woche: woche.woche,
      jahr: woche.jahr,
    });
  });

  protected readonly wertText = computed(() => {
    const wert = this.wert();
    return wert === null ? null : this.i18n.translate('karte.prozent', { wert: Math.round(wert * 100) });
  });

  constructor() {
    this.arten.ladeListe();
    effect(() => {
      void this.holeWert(this.fund(), this.karte.woche());
    });
  }

  protected async speichere(abgabe: FundAbgabe): Promise<void> {
    this.beschaeftigt.set(true);
    try {
      if (await this.eintraege.aendereFund(this.fund().id, abgabe.eingabe)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.bearbeitet.set(false);
      }
    } finally {
      this.beschaeftigt.set(false);
    }
  }

  protected async loesche(): Promise<void> {
    this.loeschFrage.set(false);
    if (await this.eintraege.loescheFund(this.fund().id)) {
      this.toasts.success(this.i18n.translate('fund.geloescht'));
      this.geschlossen.emit();
    }
  }

  /**
   * Liest den Wert der aktiven Woche am Ort des Fundes. Ohne Vorhersagekarte
   * für diese Art bleibt die Zeile weg, statt eine Null zu behaupten.
   */
  private async holeWert(fund: Fund, wochenSchluessel: string | null): Promise<void> {
    this.wert.set(null);
    this.woche.set(null);
    const kartenSlug = this.art()?.kartenSlug ?? null;
    if (kartenSlug === null) return;
    try {
      const manifest = await this.manifeste.hole(kartenSlug);
      const woche =
        (wochenSchluessel !== null ? findeWoche(manifest, wochenSchluessel) : null) ??
        aktuelleWoche(manifest);
      if (woche === null) return;
      this.woche.set(woche);
      this.wert.set(await wertAmPunkt(manifest, woche.kachelPfad, fund.lon, fund.lat));
    } catch {
      // Ohne Manifest gibt es keine Zahl mit Bezug, also auch keine Zeile.
    }
  }
}
