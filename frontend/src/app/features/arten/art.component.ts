import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import type { Art, Masse, Reagenzeintrag, SaisonKurve, Spanne, Verweis } from '../../core/api/models';
import { WERTIGKEIT_SCHWAECHSTE } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ActionBarComponent,
  KeyValueRowComponent,
  KeyValueTableComponent,
  LookalikeRowComponent,
  NoteComponent,
  PageHeaderComponent,
  SeasonCurveComponent,
  SvgIconComponent,
  type Monatsmarke,
} from '../../ui';
import { langesDatum } from '../eintraege/formate';
import { ArtenZustand } from './arten.zustand';
import {
  ESSBARKEIT_BADGE,
  ESSBARKEIT_TEXT,
  GEFAEHRDUNG_TEXT,
  HAEUFIGKEIT_TEXT,
  MERKMAL_TEXT,
  REAGENZ_TEXT,
  STUFE_BADGE,
  TAG_TEXT,
  WARNUNG_TEXT,
} from './beschriftungen';

/**
 * Die fünf Monatsmarken unter der Kurve, jede auf der ISO-Woche, in der ihr
 * Monat beginnt. Sie liegen damit auf derselben Skala wie die Kurve selbst.
 */
const MONATE: readonly { schluessel: TranslationKey; woche: number }[] = [
  { schluessel: 'art.monat.jan', woche: 1 },
  { schluessel: 'art.monat.apr', woche: 14 },
  { schluessel: 'art.monat.jul', woche: 27 },
  { schluessel: 'art.monat.okt', woche: 40 },
  { schluessel: 'art.monat.dez', woche: 49 },
];

/** Die Maße in der Reihenfolge, in der die Artseite sie nennt. */
const MASSE_ZEILEN: readonly { feld: keyof Masse; schluessel: TranslationKey; mikro: boolean }[] = [
  { feld: 'hutBreiteCm', schluessel: 'art.masse.hut', mikro: false },
  { feld: 'fruchtkoerperBreiteCm', schluessel: 'art.masse.fruchtkoerperBreite', mikro: false },
  { feld: 'fruchtkoerperHoeheCm', schluessel: 'art.masse.fruchtkoerperHoehe', mikro: false },
  { feld: 'stielLaengeCm', schluessel: 'art.masse.stielLaenge', mikro: false },
  { feld: 'stielDickeCm', schluessel: 'art.masse.stielDicke', mikro: false },
  { feld: 'sporenLaengeUm', schluessel: 'art.masse.sporenLaenge', mikro: true },
  { feld: 'sporenBreiteUm', schluessel: 'art.masse.sporenBreite', mikro: true },
];

interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Die Skala der Wertigkeit: eine Stufe je Feld, die erreichte ist gefüllt. */
interface Wertigkeit {
  stufen: number[];
  wert: number;
  text: string;
  beschriftung: string;
}

interface Merkmalzeile {
  schluessel: string;
  text?: string;
  badge?: Marke;
  wertigkeit?: Wertigkeit;
}

interface Verwechslungszeile {
  name: string;
  lateinisch: string | null;
  merkmal: string;
  badge: Marke | null;
  /** Der Weg zum eigenen Profil des Partners, wenn es eines gibt. */
  route: string | null;
}

interface Reagenzzeile {
  reagenz: string;
  reaktion: string;
}

/** Die Artseite, fertig für die Vorlage. */
interface Ansicht {
  slug: string;
  name: string;
  untertitel: string;
  marken: Marke[];
  warnung: string | null;
  sammelbar: boolean;
  saison: SaisonKurve | null;
  hatKurve: boolean;
  achse: string;
  monate: Monatsmarke[];
  legendeLaufend: string;
  legendeJahre: string;
  beschriftung: string;
  merkmale: Merkmalzeile[];
  reagenzien: Reagenzzeile[];
  verwechslungen: Verwechslungszeile[];
  betrifft: { name: string; route: string }[];
  links: Verweis[];
  geprueft: string;
  kartenSlug: string | null;
  woche: number;
}

/**
 * Die Artseite: Saisonkurve, Merkmalstabelle, Reagenzien, Verwechslungen und
 * der Sprung auf die Karte. Das Profil kommt aus dem Katalog im Speicher; ein
 * zweiter Besuch derselben Art fragt den Server nicht noch einmal.
 *
 * Nicht jede Art hier wird gesammelt: 224 Profile stehen im Katalog, weil eine
 * sammelbare Art ihnen ähnlich sieht. Sie tragen keine Saison und keinen Weg
 * auf die Karte, dafür oben den Hinweis und den Rückweg.
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
    LookalikeRowComponent,
    NoteComponent,
    PageHeaderComponent,
    SeasonCurveComponent,
    SvgIconComponent,
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
  protected readonly origin = this.zustand.origin;
  protected readonly ansicht = computed<Ansicht | null>(() => {
    const art = this.zustand.profile().get(this.slug());
    return art ? this.baue(art) : null;
  });

  /** Der Rückweg von einem Verwechslungsprofil: zur Art, von der man kam. */
  protected readonly rueckweg = computed(() => {
    const herkunft = this.origin();
    return herkunft && herkunft.slug !== this.slug()
      ? this.i18n.translate('art.zurueckZu', { name: herkunft.name })
      : this.i18n.translate('art.zuDenArten');
  });

  constructor() {
    effect(() => {
      this.zustand.ladeProfil(this.slug());
    });
  }

  protected zurueck(): void {
    void this.router.navigate(['/arten']);
  }

  /** Vom Verwechslungsprofil zurück zu der Art, die auf es gezeigt hat. */
  protected zumUrsprung(): void {
    const herkunft = this.origin();
    if (herkunft && herkunft.slug !== this.slug()) {
      void this.router.navigate(['/arten', herkunft.slug]);
      return;
    }
    this.zurueck();
  }

  /** Merkt, von welcher Art der Sprung kam, damit der Rückweg sie kennt. */
  protected zurVerwechslung(zeile: Verwechslungszeile): void {
    const ansicht = this.ansicht();
    if (!zeile.route || !ansicht) return;
    this.zustand.setOrigin({ slug: ansicht.slug, name: ansicht.name });
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
    const stufenWarnung = WARNUNG_TEXT[art.speisewert];
    const reagenzien = this.reagenzzeilen(art.reagenzien);
    return {
      slug: art.slug,
      name: art.name,
      untertitel: this.i18n.translate('art.untertitel', {
        latein: art.lateinisch,
        gruppe: this.i18n.translate(TAG_TEXT[art.gruppe]),
      }),
      marken,
      // Der Satz aus dem Profil sagt mehr als die Stufe; er hat Vorrang.
      warnung: art.warnung ?? (stufenWarnung ? this.i18n.translate(stufenWarnung) : null),
      sammelbar: art.sammelbar,
      saison,
      // Eine Reihe ohne einen einzigen Fund wäre eine gerade Linie auf null und
      // sagte über die Saison nichts.
      hatKurve: saison !== null && saison.hoechstwert > 0,
      achse: this.i18n.translate('art.kurve.achse', { wert: Math.round(saison?.hoechstwert ?? 0) }),
      monate: MONATE.map((monat) => ({
        text: this.i18n.translate(monat.schluessel),
        woche: monat.woche,
      })),
      legendeLaufend: this.i18n.translate('art.kurve.laufend', {
        jahr: saison?.stand.jahr ?? 0,
        woche: saison?.stand.woche ?? 0,
      }),
      legendeJahre: this.i18n.translate('art.kurve.jahre', {
        von: saison?.jahre.von ?? 0,
        bis: saison?.jahre.bis ?? 0,
      }),
      beschriftung: this.i18n.translate('art.kurve.beschriftung', {
        name: art.name,
        hoechstwert: Math.round(saison?.hoechstwert ?? 0),
      }),
      merkmale: this.merkmalzeilen(art, reagenzien.length > 0),
      reagenzien,
      verwechslungen: art.verwechslungen.map((verwechslung) => {
        // D1g nennt die Felder `unterschied` und `speisewert`, heute heißen sie
        // `merkmal` und `essbar`. Die Seite liest beide.
        const stufe = verwechslung.speisewert ?? verwechslung.essbar ?? null;
        return {
          name: verwechslung.name,
          lateinisch: verwechslung.lateinisch ?? null,
          merkmal: verwechslung.unterschied ?? verwechslung.merkmal ?? '',
          badge: stufe === null ? null : this.essbar(stufe),
          route: verwechslung.slug === null ? null : `/arten/${verwechslung.slug}`,
        };
      }),
      betrifft: (art.betrifft ?? []).map((eintrag) => ({
        name: eintrag.name,
        route: `/arten/${eintrag.slug}`,
      })),
      links: art.links,
      geprueft: this.i18n.translate('art.geprueft', {
        datum: langesDatum(art.quelle.geprueftAm, this.i18n.locale()),
      }),
      kartenSlug: art.kartenSlug,
      woche: saison?.stand.woche ?? 0,
    };
  }

  /**
   * Die Merkmalstabelle in der Reihenfolge der Mockups. Die geprüften Angaben
   * hängen sich an den Speisewert, weil sie dieselbe Frage beantworten: was ist
   * die Art wert. Maße und Namen stehen am Ende.
   */
  private merkmalzeilen(art: Art, eigeneReagenzien: boolean): Merkmalzeile[] {
    const zeilen: Merkmalzeile[] = [];
    for (const merkmal of art.merkmale) {
      // Stehen die Reagenzien als eigene Tabelle, gehören sie nicht auch hierhin.
      if (merkmal.schluessel === 'reagenzien' && eigeneReagenzien) continue;
      if (merkmal.schluessel !== 'speisewert') {
        zeilen.push({
          schluessel: this.i18n.translate(MERKMAL_TEXT[merkmal.schluessel]),
          text: merkmal.text,
        });
        continue;
      }
      zeilen.push({
        schluessel: this.i18n.translate(MERKMAL_TEXT.speisewert),
        text: merkmal.text,
        badge: this.essbar(art.speisewert),
      });
      zeilen.push(...this.wertzeilen(art));
    }
    zeilen.push(...this.masszeilen(art.masse), ...this.namenzeilen(art));
    return zeilen;
  }

  /** Wertigkeit, Marktfähigkeit, Häufigkeit und Rote Liste, soweit bekannt. */
  private wertzeilen(art: Art): Merkmalzeile[] {
    const zeilen: Merkmalzeile[] = [];
    if (art.wertigkeit !== null) {
      zeilen.push({
        schluessel: this.i18n.translate('art.merkmal.wertigkeit'),
        wertigkeit: this.wertigkeit(art.wertigkeit),
      });
    }
    zeilen.push({
      schluessel: this.i18n.translate('art.merkmal.marktfaehig'),
      text: `${this.i18n.translate(art.marktfaehigkeit.marktfaehig ? 'art.markt.ja' : 'art.markt.nein')} ${this.i18n.translate(
        'art.markt.stand',
        { datum: langesDatum(art.marktfaehigkeit.quelle.geprueftAm, this.i18n.locale()) },
      )}`,
    });
    if (art.haeufigkeit !== null) {
      zeilen.push({
        schluessel: this.i18n.translate('art.merkmal.haeufigkeit'),
        text: this.i18n.translate(HAEUFIGKEIT_TEXT[art.haeufigkeit]),
      });
    }
    if (art.gefaehrdung !== null) {
      zeilen.push({
        schluessel: this.i18n.translate('art.merkmal.gefaehrdung'),
        badge: { text: this.i18n.translate(GEFAEHRDUNG_TEXT[art.gefaehrdung]), variant: 'warning' },
      });
    }
    return zeilen;
  }

  private wertigkeit(wert: number): Wertigkeit {
    return {
      stufen: Array.from({ length: WERTIGKEIT_SCHWAECHSTE }, (_, i) => i + 1),
      wert,
      text: this.i18n.translate('art.wertigkeit.skala', {
        wert,
        gesamt: WERTIGKEIT_SCHWAECHSTE,
      }),
      beschriftung: this.i18n.translate('art.wertigkeit.beschriftung', {
        wert,
        gesamt: WERTIGKEIT_SCHWAECHSTE,
      }),
    };
  }

  /** Alle Maße in einer Zeile; was die Quelle nicht nennt, fehlt darin. */
  private masszeilen(masse: Masse): Merkmalzeile[] {
    const teile = MASSE_ZEILEN.flatMap((zeile) => {
      const spanne = masse[zeile.feld];
      return spanne === null
        ? []
        : [this.i18n.translate(zeile.schluessel, { spanne: this.spanne(spanne, zeile.mikro) })];
    });
    if (teile.length === 0) return [];
    return [{ schluessel: this.i18n.translate('art.merkmal.masse'), text: teile.join(' · ') }];
  }

  private spanne(spanne: Spanne, mikro: boolean): string {
    const einheit = this.i18n.translate(mikro ? 'art.masse.um' : 'art.masse.cm');
    const zahl = (wert: number): string => wert.toLocaleString(this.i18n.locale());
    if (spanne.seltenBis === null) {
      return this.i18n.translate('art.masse.spanne', {
        von: zahl(spanne.von),
        bis: zahl(spanne.bis),
        einheit,
      });
    }
    return this.i18n.translate('art.masse.spanneSelten', {
      von: zahl(spanne.von),
      bis: zahl(spanne.bis),
      seltenBis: zahl(spanne.seltenBis),
      einheit,
    });
  }

  private namenzeilen(art: Art): Merkmalzeile[] {
    const zeilen: Merkmalzeile[] = [];
    if (art.weitereNamen.length > 0) {
      zeilen.push({
        schluessel: this.i18n.translate('art.merkmal.weitereNamen'),
        text: art.weitereNamen.join(', '),
      });
    }
    if (art.synonyme.length > 0) {
      zeilen.push({
        schluessel: this.i18n.translate('art.merkmal.synonyme'),
        text: art.synonyme.join(', '),
      });
    }
    return zeilen;
  }

  private reagenzzeilen(eintraege: readonly Reagenzeintrag[]): Reagenzzeile[] {
    return eintraege.map((eintrag) => ({
      reagenz: this.i18n.translate(REAGENZ_TEXT[eintrag.reagenz]),
      reaktion: eintrag.reaktion,
    }));
  }

  private essbar(wert: Art['speisewert']): Marke {
    return { text: this.i18n.translate(ESSBARKEIT_TEXT[wert]), variant: ESSBARKEIT_BADGE[wert] };
  }
}
