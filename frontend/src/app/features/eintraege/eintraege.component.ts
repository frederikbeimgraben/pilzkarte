import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, ButtonComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import type { Fund, GeteilterFund, Marker, Sichtbarkeit, Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import type { WarteArt, WarteEintrag } from '../../core/offline/warteschlange';
import {
  ChipGroupComponent,
  ListRowComponent,
  NoteComponent,
  PageHeaderComponent,
  SvgIconComponent,
  type Chip,
} from '../../ui';
import { ArtenZustand } from '../arten/arten.zustand';
import { EintragenZustand } from '../eintragen/eintragen.zustand';
import { sichtbarkeitText } from '../eintragen/sichtbarkeit';
import { schreibeObjekt, type ObjektArt } from '../karte/karten-zustand';
import { EintraegeZustand } from './eintraege.zustand';
import { farbeHex } from './farben';
import { hektarText, isoDatum, kurzesDatum } from './formate';

/** Die vier Chips über der Liste, wie im Artboard `Funde`. */
type ChipWert = 'funde' | 'marker' | 'zonen' | 'geteilt';

const CHIPS: readonly { wert: ChipWert; label: TranslationKey; warte: WarteArt }[] = [
  { wert: 'funde', label: 'eintraege.chip.funde', warte: 'fund' },
  { wert: 'marker', label: 'eintraege.chip.marker', warte: 'marker' },
  { wert: 'zonen', label: 'eintraege.chip.zonen', warte: 'zone' },
  { wert: 'geteilt', label: 'eintraege.chip.geteilt', warte: 'fund' },
];

/** Ein Kennzeichen rechts an der Zeile. */
interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Eine Zeile der Liste, fertig für die Vorlage. */
interface Zeile {
  schluessel: string;
  farbe: string;
  titel: string;
  unter: string;
  notiz: string;
  marke: Marke | null;
  /** `null` bei einem Eintrag, der noch auf die Übertragung wartet. */
  objekt: { art: ObjektArt; id: string } | null;
}

/**
 * Die Farben der Punkte vor einer Zeile, aus `docs/mockups/bauen.py`: ein
 * eigener Fund trägt `accent4`, ein fremder geteilter das gedämpfte `info`.
 */
const EIGENER_FUND = '#c8a25a';
const FREMDER_FUND = '#185468';

/**
 * Der Reiter Einträge (Artboard `Funde`): Chips, Liste, und ein Tipp öffnet
 * das Objekt über der Karte.
 *
 * Was noch auf die Übertragung wartet, steht mit seinem Kennzeichen oben in
 * der Liste. Öffnen lässt es sich nicht: es hat noch keine Kennung vom Dienst.
 */
@Component({
  selector: 'app-eintraege',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ChipGroupComponent,
    ListRowComponent,
    NoteComponent,
    PageHeaderComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './eintraege.component.html',
  styleUrl: './eintraege.component.scss',
})
export class EintraegeComponent {
  private readonly arten = inject(ArtenZustand);
  private readonly eintragenZustand = inject(EintragenZustand);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly zustand = inject(EintraegeZustand);

  protected readonly chip = signal<ChipWert>('funde');
  protected readonly angemeldet = this.zustand.angemeldet;

  protected readonly chips = computed<Chip[]>(() =>
    CHIPS.map((chip) => ({ wert: chip.wert, label: this.i18n.translate(chip.label) })),
  );

  protected readonly zeilen = computed<Zeile[]>(() => {
    const chip = this.chip();
    if (chip === 'geteilt') return this.zustand.geteilte().map((fund) => this.geteilteZeile(fund));
    const warte = CHIPS.find((kandidat) => kandidat.wert === chip)?.warte ?? 'fund';
    const wartend = this.zustand
      .wartende()
      .filter((eintrag) => eintrag.art === warte)
      .map((eintrag) => this.warteZeile(eintrag));
    if (chip === 'marker') {
      return [...wartend, ...this.zustand.marker().map((eintrag) => this.markerZeile(eintrag))];
    }
    if (chip === 'zonen') return [...wartend, ...this.zustand.zonen().map((zone) => this.zonenZeile(zone))];
    return [...wartend, ...this.zustand.funde().map((fund) => this.fundZeile(fund))];
  });

  protected readonly leerText = computed<TranslationKey>(() =>
    this.chip() === 'geteilt' ? 'eintraege.leerGeteilt' : 'eintraege.leer',
  );

  constructor() {
    this.arten.ladeListe();
    void this.zustand.lade();
    void this.zustand.ladeGeteilte();
  }

  protected waehleChip(wert: string): void {
    const chip = CHIPS.find((kandidat) => kandidat.wert === wert);
    if (chip) this.chip.set(chip.wert);
  }

  /** Der Plus-Knopf der Kopfleiste führt auf die Karte und öffnet das Menü. */
  protected async eintragen(): Promise<void> {
    await this.router.navigate(['/karte']);
    this.eintragenZustand.oeffne();
  }

  protected oeffne(zeile: Zeile): void {
    if (zeile.objekt === null) return;
    void this.router.navigate(['/karte'], { queryParams: { objekt: schreibeObjekt(zeile.objekt) } });
  }

  private artName(slug: string): string {
    return (this.arten.liste()?.arten ?? []).find((art) => art.slug === slug)?.name ?? slug;
  }

  private datum(iso: string): string {
    return kurzesDatum(iso, this.i18n.locale(), isoDatum(new Date()), this.i18n.translate('eintraege.heute'));
  }

  /** „6. Sept. · 3 Stück · Frederik“, so wie im Artboard `Funde`. */
  private fundUnter(datum: string, anzahl: number | null, melder: string): string {
    if (anzahl === null) return this.i18n.translate('fund.unterOhneAnzahl', { datum, melder });
    return this.i18n.translate('fund.unter', {
      datum,
      anzahl: this.i18n.translate('fund.stueck', { anzahl }),
      melder,
    });
  }

  private geteiltMarke(sichtbarkeit: Sichtbarkeit): Marke | null {
    return sichtbarkeit === 'geteilt'
      ? { text: this.i18n.translate('eintraege.badge.geteilt'), variant: 'success' }
      : null;
  }

  private fundZeile(fund: Fund): Zeile {
    return {
      schluessel: `fund-${fund.id}`,
      farbe: EIGENER_FUND,
      titel: this.artName(fund.artSlug),
      unter: this.fundUnter(this.datum(fund.datum), fund.anzahl, this.zustand.melder() ?? ''),
      notiz: fund.notiz ?? '',
      marke: this.geteiltMarke(fund.sichtbarkeit),
      objekt: { art: 'fund', id: fund.id },
    };
  }

  private geteilteZeile(fund: GeteilterFund): Zeile {
    return {
      schluessel: `geteilt-${fund.id}`,
      farbe: fund.eigen ? EIGENER_FUND : FREMDER_FUND,
      titel: this.artName(fund.artSlug),
      unter: this.fundUnter(this.datum(fund.datum), fund.anzahl, fund.melder ?? ''),
      notiz: fund.notiz ?? '',
      marke: { text: this.i18n.translate('eintraege.badge.geteilt'), variant: 'success' },
      // Ein fremder Fund hat kein Blatt: der Dienst gibt ihn nur als Punkt her.
      objekt: fund.eigen ? { art: 'fund', id: fund.id } : null,
    };
  }

  private markerZeile(marker: Marker): Zeile {
    return {
      schluessel: `marker-${marker.id}`,
      farbe: farbeHex(marker.farbe),
      titel: marker.name,
      unter: this.i18n.translate('marker.unter', {
        sichtbarkeit: sichtbarkeitText(this.i18n, marker.sichtbarkeit),
      }),
      notiz: marker.notiz ?? '',
      marke: this.geteiltMarke(marker.sichtbarkeit),
      objekt: { art: 'marker', id: marker.id },
    };
  }

  private zonenZeile(zone: Zone): Zeile {
    return {
      schluessel: `zone-${zone.id}`,
      farbe: farbeHex(zone.farbe),
      titel: zone.name,
      unter: this.i18n.translate('zone.unter', {
        flaeche: hektarText(zone.flaecheHa, this.i18n.locale()),
        sichtbarkeit: sichtbarkeitText(this.i18n, zone.sichtbarkeit),
      }),
      notiz: zone.notiz ?? '',
      marke: this.geteiltMarke(zone.sichtbarkeit),
      objekt: { art: 'zone', id: zone.id },
    };
  }

  private warteZeile(eintrag: WarteEintrag): Zeile {
    const koerper = eintrag.koerper;
    const titel = 'artSlug' in koerper ? this.artName(koerper.artSlug) : koerper.name;
    const unter =
      'datum' in koerper
        ? this.fundUnter(this.datum(koerper.datum), koerper.anzahl ?? null, this.zustand.melder() ?? '')
        : '';
    return {
      schluessel: `warte-${eintrag.id}`,
      farbe: 'farbe' in koerper ? farbeHex(koerper.farbe) : EIGENER_FUND,
      titel,
      unter,
      notiz: koerper.notiz ?? '',
      marke: { text: this.i18n.translate('eintraege.badge.ausstehend'), variant: 'warning' },
      objekt: null,
    };
  }
}
