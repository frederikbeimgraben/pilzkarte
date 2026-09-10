import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CardComponent, DialogComponent, ToastService } from '@stupa-makers/ui-kit';
import { firstValueFrom } from 'rxjs';
import { EintraegeApi } from '../../core/api/eintraege.api';
import type { Zone, ZonenWert } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { aktuelleWoche, findeWoche } from '../../core/kacheln/manifest';
import { ManifestDienst } from '../../core/kacheln/manifest.service';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import { ActionBarComponent, KeyValueTableComponent, MetricRowComponent, NoteComponent } from '../../ui';
import { ArtenZustand } from '../arten/arten.zustand';
import { EintraegeZustand } from '../eintraege/eintraege.zustand';
import { farbeHex } from '../eintraege/farben';
import { hektarText } from '../eintraege/formate';
import { alsPolygon } from '../eintragen/flaeche';
import { ObjektFormularComponent, type ObjektWerte } from '../eintragen/objekt-formular.component';
import { sichtbarkeitText } from '../eintragen/sichtbarkeit';
import { ZONEN_ZEICHNER, type ZeichenSitzung } from '../eintragen/zonen-zeichner';
import { KartenZustand } from '../karte/karten-zustand';
import type { Ort } from '../eintragen/eintragen.zustand';

/**
 * Das Objekt-Blatt einer Zone (Artboard `Zone`).
 *
 * Die zwei Kennzahlen kommen vom Dienst: das Flächenmittel der Vorhersage für
 * genau die Art und Woche der Karte, und die eigenen Funde in der Fläche über
 * alle Arten und Jahre. „Eckpunkte bearbeiten“ gibt die Ecken an Terra Draw,
 * wo sie sich mit dem Finger ziehen lassen.
 */
@Component({
  selector: 'app-zone-blatt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CardComponent,
    DialogComponent,
    KeyValueTableComponent,
    MetricRowComponent,
    NoteComponent,
    ObjektFormularComponent,
    TranslatePipe,
  ],
  templateUrl: './zone-blatt.component.html',
  styleUrl: './zone-blatt.component.scss',
})
export class ZoneBlattComponent implements OnDestroy {
  private readonly adapter = inject(KARTE_ADAPTER);
  private readonly api = inject(EintraegeApi);
  private readonly arten = inject(ArtenZustand);
  private readonly eintraege = inject(EintraegeZustand);
  private readonly i18n = inject(I18nService);
  private readonly karte = inject(KartenZustand);
  private readonly manifeste = inject(ManifestDienst);
  private readonly toasts = inject(ToastService);
  private readonly zeichne = inject(ZONEN_ZEICHNER);

  private readonly formular = viewChild(ObjektFormularComponent);

  readonly zone = input.required<Zone>();

  readonly zeigeAufKarte = output<readonly [number, number]>();
  readonly geschlossen = output();

  protected readonly loeschFrage = signal(false);
  protected readonly beschaeftigt = signal(false);
  protected readonly bearbeitetEcken = signal(false);
  private readonly wert = signal<ZonenWert | null>(null);
  private readonly neueEcken = signal<readonly Ort[] | null>(null);
  private sitzung: ZeichenSitzung | null = null;

  protected readonly unterzeile = computed(() =>
    this.i18n.translate('zone.unter', {
      flaeche: hektarText(this.zone().flaecheHa, this.i18n.locale()),
      sichtbarkeit: sichtbarkeitText(this.i18n, this.zone().sichtbarkeit),
    }),
  );

  protected readonly start = computed<ObjektWerte>(() => {
    const zone = this.zone();
    return { name: zone.name, farbe: zone.farbe, notiz: zone.notiz, sichtbarkeit: zone.sichtbarkeit };
  });

  protected readonly vorhersageZeile = computed(() => {
    const wert = this.wert();
    if (wert === null) return null;
    return {
      beschriftung: this.i18n.translate('zone.vorhersage', {
        art: this.artName(wert.art),
        woche: wert.woche.woche,
      }),
      wert: this.i18n.translate('karte.prozent', { wert: Math.round(wert.flaechenmittel) }),
      funde: String(wert.eigeneFunde),
    };
  });

  /** Der Mittelpunkt der Fläche, damit „Auf der Karte“ die Zone zeigt. */
  protected readonly mitte = computed<readonly [number, number]>(() => {
    const ring = this.zone().polygon.coordinates[0];
    const summe = ring.reduce((links, punkt) => [links[0] + punkt[0], links[1] + punkt[1]], [0, 0]);
    return [summe[0] / ring.length, summe[1] / ring.length];
  });

  constructor() {
    this.arten.ladeListe();
    effect(() => {
      void this.holeWert(this.zone().id, this.karte.art(), this.karte.woche());
    });
  }

  ngOnDestroy(): void {
    this.beendeSitzung();
  }

  protected async speichere(): Promise<void> {
    const werte = this.formular()?.werte();
    if (!werte) return;
    this.beschaeftigt.set(true);
    try {
      if (await this.eintraege.aendereZone(this.zone().id, werte)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
      }
    } finally {
      this.beschaeftigt.set(false);
    }
  }

  /** Gibt die Ecken an Terra Draw. Sie lassen sich dann mit dem Finger ziehen. */
  protected async bearbeiteEcken(): Promise<void> {
    const karte = this.adapter.rohkarte();
    if (karte === null) return;
    this.bearbeitetEcken.set(true);
    this.sitzung = await this.zeichne(karte, farbeHex(this.zone().farbe));
    const ring = this.zone()
      .polygon.coordinates[0].slice(0, -1)
      .map((punkt) => punkt as Ort);
    this.sitzung.zeigeRing(ring);
    this.sitzung.bearbeiten((neu) => {
      this.neueEcken.set(neu);
    });
  }

  protected async uebernimmEcken(): Promise<void> {
    const ecken = this.neueEcken();
    const polygon = ecken === null ? null : alsPolygon(ecken);
    this.beendeSitzung();
    if (polygon === null) return;
    if (await this.eintraege.aendereZone(this.zone().id, { polygon })) {
      this.toasts.success(this.i18n.translate('objekt.gespeichert'));
    }
  }

  protected brichEckenAb(): void {
    this.beendeSitzung();
  }

  protected async loesche(): Promise<void> {
    this.loeschFrage.set(false);
    if (await this.eintraege.loescheZone(this.zone().id)) {
      this.toasts.success(this.i18n.translate('objekt.geloescht'));
      this.geschlossen.emit();
    }
  }

  private artName(slug: string): string {
    return (this.arten.liste()?.arten ?? []).find((art) => art.slug === slug)?.name ?? slug;
  }

  /**
   * Fragt den Dienst nach dem Flächenmittel. Der Endpunkt kennt Arten des
   * Katalogs; die Karte kennt nur den Slug ihrer Kacheln, darum der Umweg.
   */
  private async holeWert(id: string, kartenSlug: string, wochenSchluessel: string | null): Promise<void> {
    this.wert.set(null);
    const art = (this.arten.liste()?.arten ?? []).find((kandidat) => kandidat.kartenSlug === kartenSlug);
    if (!art) return;
    try {
      const manifest = await this.manifeste.hole(kartenSlug);
      const woche =
        (wochenSchluessel !== null ? findeWoche(manifest, wochenSchluessel) : null) ??
        aktuelleWoche(manifest);
      if (woche === null) return;
      this.wert.set(await firstValueFrom(this.api.zonenWert(id, art.slug, woche.jahr, woche.woche)));
    } catch {
      // Ohne Karte für diese Art und Woche bleibt die Zeile weg.
    }
  }

  private beendeSitzung(): void {
    this.sitzung?.beende();
    this.sitzung = null;
    this.neueEcken.set(null);
    this.bearbeitetEcken.set(false);
  }
}
