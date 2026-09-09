import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import type { Art, SaisonKurve, Verweis } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ActionBarComponent,
  KeyValueRowComponent,
  KeyValueTableComponent,
  NoteComponent,
  PageHeaderComponent,
  SeasonCurveComponent,
} from '../../ui';
import { ArtenZustand } from './arten.zustand';
import { ESSBARKEIT_BADGE, ESSBARKEIT_TEXT, MERKMAL_TEXT, STUFE_BADGE, TAG_TEXT } from './beschriftungen';

/** Die fünf Monatsmarken unter der Kurve, gleichmäßig über das Jahr verteilt. */
const MONATE: readonly TranslationKey[] = [
  'art.monat.jan',
  'art.monat.apr',
  'art.monat.jul',
  'art.monat.okt',
  'art.monat.dez',
];

interface Marke {
  text: string;
  variant: BadgeVariant;
}

interface Merkmalzeile {
  schluessel: string;
  text?: string;
  badge?: Marke;
}

interface Verwechslungszeile {
  name: string;
  merkmal: string;
  badge: Marke;
}

/** Die Artseite, fertig für die Vorlage. */
interface Ansicht {
  name: string;
  untertitel: string;
  marken: Marke[];
  saison: SaisonKurve;
  hatKurve: boolean;
  achse: string;
  monate: string[];
  legendeLaufend: string;
  legendeJahre: string;
  beschriftung: string;
  merkmale: Merkmalzeile[];
  verwechslungen: Verwechslungszeile[];
  links: Verweis[];
  kartenSlug: string | null;
  woche: number;
}

/**
 * Die Artseite: Saisonkurve, Merkmalstabelle, Verwechslungen und der Sprung auf
 * die Karte. Das Profil kommt aus dem Katalog im Speicher; ein zweiter Besuch
 * derselben Art fragt den Server nicht noch einmal.
 */
@Component({
  selector: 'app-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    CardComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    NoteComponent,
    PageHeaderComponent,
    SeasonCurveComponent,
    TranslatePipe,
  ],
  templateUrl: './art.component.html',
  styleUrl: './art.component.scss',
})
export class ArtComponent {
  private readonly zustand = inject(ArtenZustand);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  protected readonly unbekannt = computed(() => this.zustand.unbekannt().has(this.slug()));
  protected readonly ansicht = computed<Ansicht | null>(() => {
    const art = this.zustand.profile().get(this.slug());
    return art ? this.baue(art) : null;
  });

  constructor() {
    effect(() => {
      this.zustand.ladeProfil(this.slug());
    });
  }

  protected zurueck(): void {
    void this.router.navigate(['/arten']);
  }

  /**
   * Merkt die Art für die Karte und springt in die Woche, auf der die Kurve
   * steht. Ohne Manifest der Kette gibt es dort nichts zu zeigen.
   */
  protected aufKarte(): void {
    const ansicht = this.ansicht();
    if (!ansicht?.kartenSlug) return;
    this.zustand.waehle(this.slug());
    void this.router.navigate(['/karte'], {
      queryParams: { art: ansicht.kartenSlug, kw: ansicht.woche },
    });
  }

  private baue(art: Art): Ansicht {
    const saison = art.saison;
    const marken: Marke[] = [
      { text: this.i18n.translate(TAG_TEXT[art.stufe]), variant: STUFE_BADGE[art.stufe] },
    ];
    if (art.geschuetzt) {
      marken.push({ text: this.i18n.translate('arten.geschuetzt'), variant: 'warning' });
    }
    return {
      name: art.name,
      untertitel: this.i18n.translate('art.untertitel', {
        latein: art.lateinisch,
        gruppe: this.i18n.translate(TAG_TEXT[art.gruppe]),
      }),
      marken,
      saison,
      // Eine Reihe ohne einen einzigen Fund wäre eine gerade Linie auf null und
      // sagte über die Saison nichts.
      hatKurve: saison.hoechstwert > 0,
      achse: this.i18n.translate('art.kurve.achse', { wert: Math.round(saison.hoechstwert) }),
      monate: MONATE.map((monat) => this.i18n.translate(monat)),
      legendeLaufend: this.i18n.translate('art.kurve.laufend', {
        jahr: saison.stand.jahr,
        woche: saison.stand.woche,
      }),
      legendeJahre: this.i18n.translate('art.kurve.jahre', {
        von: saison.jahre.von,
        bis: saison.jahre.bis,
      }),
      beschriftung: this.i18n.translate('art.kurve.beschriftung', {
        name: art.name,
        hoechstwert: Math.round(saison.hoechstwert),
      }),
      merkmale: art.merkmale.map((merkmal) => ({
        schluessel: this.i18n.translate(MERKMAL_TEXT[merkmal.schluessel]),
        // Der Speisewert steht als Enum fest; als Badge sagt er dasselbe kürzer.
        text: merkmal.schluessel === 'speisewert' ? undefined : merkmal.text,
        badge: merkmal.schluessel === 'speisewert' ? this.essbar(art.speisewert) : undefined,
      })),
      verwechslungen: art.verwechslungen.map((verwechslung) => ({
        name: verwechslung.name,
        merkmal: verwechslung.merkmal,
        badge: this.essbar(verwechslung.essbar),
      })),
      links: art.links,
      kartenSlug: art.kartenSlug,
      woche: saison.stand.woche,
    };
  }

  private essbar(wert: Art['speisewert']): Marke {
    return { text: this.i18n.translate(ESSBARKEIT_TEXT[wert]), variant: ESSBARKEIT_BADGE[wert] };
  }
}
