import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import type { Species, Masse, Reagenzeintrag, SeasonCurveData, Spanne, Link } from '../../core/api/models';
import { TIER_WEAKEST } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ActionBarComponent,
  KeyValueRowComponent,
  EmptyStateComponent,
  InfoTextComponent,
  KeyValueTableComponent,
  LookalikeRowComponent,
  NoteComponent,
  PageHeaderComponent,
  SeasonCurveComponent,
  SvgIconComponent,
  type MonthMark,
} from '../../ui';
import { SpeciesImagesComponent } from './species-images.component';
import { longDate } from '../../core/i18n/dates';
import { SpeciesState } from './species.state';
import { MapState } from '../map/map.state';
import { FORECAST_SLUGS, type ForecastSlug } from '../../core/tiles/tile-paths';
import {
  EDIBILITY_BADGE,
  EDIBILITY_TEXT,
  GEFAEHRDUNG_TEXT,
  HAEUFIGKEIT_TEXT,
  FEATURE_TEXT,
  REAGENZ_TEXT,
  LEVEL_BADGE,
  TAG_TEXT,
  WARNUNG_TEXT,
} from './labels';

/**
 * Die fünf Monatsmarken unter der Kurve, jede auf der ISO-Woche, in der ihr
 * Monat beginnt. Sie liegen damit auf derselben Skala wie die Kurve selbst.
 */
const MONTHS: readonly { schluessel: TranslationKey; woche: number }[] = [
  { schluessel: 'art.monat.jan', woche: 1 },
  { schluessel: 'art.monat.apr', woche: 14 },
  { schluessel: 'art.monat.jul', woche: 27 },
  { schluessel: 'art.monat.okt', woche: 40 },
  { schluessel: 'art.monat.dez', woche: 49 },
];

/** Die Maße in der Reihenfolge, in der die Artseite sie nennt. */
const MEASURE_ROWS: readonly { field: keyof Masse; schluessel: TranslationKey; mikro: boolean }[] = [
  { field: 'hutBreiteCm', schluessel: 'art.masse.hut', mikro: false },
  { field: 'fruchtkoerperBreiteCm', schluessel: 'art.masse.fruchtkoerperBreite', mikro: false },
  { field: 'fruchtkoerperHoeheCm', schluessel: 'art.masse.fruchtkoerperHoehe', mikro: false },
  { field: 'stielLaengeCm', schluessel: 'art.masse.stielLaenge', mikro: false },
  { field: 'stielDickeCm', schluessel: 'art.masse.stielDicke', mikro: false },
  { field: 'sporenLaengeUm', schluessel: 'art.masse.sporenLaenge', mikro: true },
  { field: 'sporenBreiteUm', schluessel: 'art.masse.sporenBreite', mikro: true },
];

interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Die Skala der Wertigkeit: eine Stufe je Feld, die erreichte ist gefüllt. */
interface Tier {
  levels: number[];
  value: number;
  text: string;
  label: string;
}

interface FeatureRow {
  schluessel: string;
  text?: string;
  badge?: Marke;
  wertigkeit?: Tier;
}

interface ConfusableRow {
  name: string;
  lateinisch: string;
  merkmal: string;
  badge: Marke;
  /** Der Weg zum Profil der anderen Art. Jedes Paar zeigt auf ein Profil. */
  route: string;
}

interface Reagenzzeile {
  reagenz: string;
  reaktion: string;
}

/** Die Artseite, fertig für die Vorlage. */
interface Viewport {
  slug: string;
  name: string;
  subtitle: string;
  badges: Marke[];
  warnung: string | null;
  sammelbar: boolean;
  saison: SeasonCurveData | null;
  hasCurve: boolean;
  axis: string;
  months: MonthMark[];
  legendCurrent: string;
  legendYears: string;
  label: string;
  merkmale: FeatureRow[];
  reagenzien: Reagenzzeile[];
  verwechslungen: ConfusableRow[];
  links: Link[];
  geprueft: string;
  kartenSlug: string | null;
  woche: number;
}

/**
 * Die Artseite: Saisonkurve, Merkmalstabelle, Reagenzien, Verwechslungen und
 * der Sprung auf die Karte. Das Profil kommt aus dem Katalog im Speicher; ein
 * zweiter Besuch derselben Art fragt den Server nicht noch einmal.
 *
 * Nicht jede Art hier wird gesammelt: 221 Profile stehen im Katalog, weil eine
 * sammelbare Art ihnen ähnlich sieht. Sie tragen keine Saison und keinen Weg
 * auf die Karte, dafür oben den Hinweis und den Rückweg.
 */
@Component({
  selector: 'app-species',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    CardComponent,
    KeyValueRowComponent,
    EmptyStateComponent,
    InfoTextComponent,
    KeyValueTableComponent,
    LookalikeRowComponent,
    NoteComponent,
    PageHeaderComponent,
    SeasonCurveComponent,
    SpeciesImagesComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './species.component.html',
  styleUrl: './species.component.scss',
})
export class SpeciesComponent {
  private readonly state = inject(SpeciesState);
  private readonly map = inject(MapState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  protected readonly unknown = computed(() => this.state.unknown().has(this.slug()));
  protected readonly origin = this.state.origin;
  protected readonly images = computed(() => this.state.images().get(this.slug()) ?? []);
  protected readonly viewport = computed<Viewport | null>(() => {
    const art = this.state.profile().get(this.slug());
    return art ? this.create(art) : null;
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
      this.state.loadProfile(this.slug());
      this.state.loadImages(this.slug());
    });
  }

  protected back(): void {
    void this.router.navigate(['/arten']);
  }

  /** Vom Verwechslungsprofil zurück zu der Art, die auf es gezeigt hat. */
  protected zumUrsprung(): void {
    const herkunft = this.origin();
    if (herkunft && herkunft.slug !== this.slug()) {
      void this.router.navigate(['/arten', herkunft.slug]);
      return;
    }
    this.back();
  }

  /** Merkt, von welcher Art der Sprung kam, damit der Rückweg sie kennt. */
  protected toLookalike(row: ConfusableRow): void {
    const viewport = this.viewport();
    if (!row.route || !viewport) return;
    this.state.setOrigin({ slug: viewport.slug, name: viewport.name });
  }

  /**
   * Merkt die Art für die Karte. Die Woche bleibt, wie sie ist: die Karte
   * steht ohnehin auf der laufenden Kalenderwoche, und das ist die Woche, auf
   * der auch die Kurve endet. Ohne Manifest der Kette gibt es nichts zu zeigen.
   */
  protected onMap(): void {
    const viewport = this.viewport();
    if (!viewport?.kartenSlug) return;
    this.state.select(this.slug());
    // Der Kartenzustand führt die Karte, nicht die Adresse. Die Art wird hier
    // gesetzt, und die Karte findet sie beim Öffnen schon vor.
    const slug = (FORECAST_SLUGS as readonly string[]).includes(viewport.kartenSlug)
      ? (viewport.kartenSlug as ForecastSlug)
      : null;
    if (slug === null) return;
    this.map.art.set(slug);
    void this.router.navigate(['/karte']);
  }

  private create(art: Species): Viewport {
    const saison = art.saison;
    const badges: Marke[] = [
      { text: this.i18n.translate(TAG_TEXT[art.stufe]), variant: LEVEL_BADGE[art.stufe] },
    ];
    if (art.geschuetzt) {
      badges.push({ text: this.i18n.translate('arten.geschuetzt'), variant: 'warning' });
    }
    const levelWarning = WARNUNG_TEXT[art.speisewert];
    const reagenzien = this.reagenzzeilen(art.reagenzien);
    return {
      slug: art.slug,
      name: art.name,
      subtitle: this.i18n.translate('art.untertitel', {
        latein: art.lateinisch,
        gruppe: this.i18n.translate(TAG_TEXT[art.gruppe]),
      }),
      badges,
      // Der Satz aus dem Profil sagt mehr als die Stufe; er hat Vorrang.
      warnung: art.warnung ?? (levelWarning ? this.i18n.translate(levelWarning) : null),
      sammelbar: art.sammelbar,
      saison,
      // Eine Reihe ohne einen einzigen Fund wäre eine gerade Linie auf null und
      // sagte über die Saison nichts.
      hasCurve: saison !== null && saison.hoechstwert > 0,
      axis: this.i18n.translate('art.kurve.achse', { wert: Math.round(saison?.hoechstwert ?? 0) }),
      months: MONTHS.map((month) => ({
        text: this.i18n.translate(month.schluessel),
        woche: month.woche,
      })),
      legendCurrent: this.i18n.translate('art.kurve.laufend', {
        jahr: saison?.stand.jahr ?? 0,
        woche: saison?.stand.woche ?? 0,
      }),
      legendYears: this.i18n.translate('art.kurve.jahre', {
        von: saison?.jahre.von ?? 0,
        bis: saison?.jahre.bis ?? 0,
      }),
      label: this.i18n.translate('art.kurve.beschriftung', {
        name: art.name,
        hoechstwert: Math.round(saison?.hoechstwert ?? 0),
      }),
      merkmale: this.featureRows(art, reagenzien.length > 0),
      reagenzien,
      verwechslungen: art.verwechslungen.map((confusable) => ({
        name: confusable.name,
        lateinisch: confusable.lateinisch,
        // Ohne Satz zählt der Name: das Paar steht in der anderen Datei.
        merkmal: confusable.unterschied ?? '',
        badge: this.essbar(confusable.speisewert),
        route: `/arten/${confusable.slug}`,
      })),
      links: art.links,
      geprueft: this.i18n.translate('art.geprueft', {
        datum: longDate(art.quelle.geprueftAm, this.i18n.locale()),
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
  private featureRows(art: Species, eigeneReagenzien: boolean): FeatureRow[] {
    const rows: FeatureRow[] = [];
    for (const merkmal of art.merkmale) {
      // Stehen die Reagenzien als eigene Tabelle, gehören sie nicht auch hierhin.
      if (merkmal.schluessel === 'reagenzien' && eigeneReagenzien) continue;
      if (merkmal.schluessel !== 'speisewert') {
        rows.push({
          schluessel: this.i18n.translate(FEATURE_TEXT[merkmal.schluessel]),
          text: merkmal.text,
        });
        continue;
      }
      rows.push({
        schluessel: this.i18n.translate(FEATURE_TEXT.speisewert),
        text: merkmal.text,
        badge: this.essbar(art.speisewert),
      });
      rows.push(...this.valueRows(art));
    }
    rows.push(...this.masszeilen(art.masse), ...this.namenzeilen(art));
    return rows;
  }

  /** Wertigkeit, Marktfähigkeit, Häufigkeit und Rote Liste, soweit bekannt. */
  private valueRows(art: Species): FeatureRow[] {
    const rows: FeatureRow[] = [];
    if (art.wertigkeit !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.merkmal.wertigkeit'),
        wertigkeit: this.wertigkeit(art.wertigkeit),
      });
    }
    rows.push({
      schluessel: this.i18n.translate('art.merkmal.marktfaehig'),
      text: `${this.i18n.translate(art.marktfaehigkeit.marktfaehig ? 'art.markt.ja' : 'art.markt.nein')} ${this.i18n.translate(
        'art.markt.stand',
        { datum: longDate(art.quelle.geprueftAm, this.i18n.locale()) },
      )}`,
    });
    if (art.haeufigkeit !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.merkmal.haeufigkeit'),
        text: this.i18n.translate(HAEUFIGKEIT_TEXT[art.haeufigkeit]),
      });
    }
    if (art.gefaehrdung !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.merkmal.gefaehrdung'),
        badge: { text: this.i18n.translate(GEFAEHRDUNG_TEXT[art.gefaehrdung]), variant: 'warning' },
      });
    }
    return rows;
  }

  private wertigkeit(value: number): Tier {
    return {
      levels: Array.from({ length: TIER_WEAKEST }, (_, i) => i + 1),
      value,
      text: this.i18n.translate('art.wertigkeit.skala', {
        wert: value,
        gesamt: TIER_WEAKEST,
      }),
      label: this.i18n.translate('art.wertigkeit.beschriftung', {
        wert: value,
        gesamt: TIER_WEAKEST,
      }),
    };
  }

  /** Alle Maße in einer Zeile; was die Quelle nicht nennt, fehlt darin. */
  private masszeilen(masse: Masse): FeatureRow[] {
    const parts = MEASURE_ROWS.flatMap((row) => {
      const spanne = masse[row.field];
      return spanne === null
        ? []
        : [this.i18n.translate(row.schluessel, { spanne: this.spanne(spanne, row.mikro) })];
    });
    if (parts.length === 0) return [];
    return [{ schluessel: this.i18n.translate('art.merkmal.masse'), text: parts.join(' · ') }];
  }

  private spanne(spanne: Spanne, mikro: boolean): string {
    const unit = this.i18n.translate(mikro ? 'art.masse.um' : 'art.masse.cm');
    const number = (value: number): string => value.toLocaleString(this.i18n.locale());
    if (spanne.seltenBis === null) {
      return this.i18n.translate('art.masse.spanne', {
        von: number(spanne.von),
        bis: number(spanne.bis),
        einheit: unit,
      });
    }
    return this.i18n.translate('art.masse.spanneSelten', {
      von: number(spanne.von),
      bis: number(spanne.bis),
      seltenBis: number(spanne.seltenBis),
      einheit: unit,
    });
  }

  private namenzeilen(art: Species): FeatureRow[] {
    const rows: FeatureRow[] = [];
    if (art.weitereNamen.length > 0) {
      rows.push({
        schluessel: this.i18n.translate('art.merkmal.weitereNamen'),
        text: art.weitereNamen.join(', '),
      });
    }
    if (art.synonyme.length > 0) {
      rows.push({
        schluessel: this.i18n.translate('art.merkmal.synonyme'),
        text: art.synonyme.join(', '),
      });
    }
    return rows;
  }

  private reagenzzeilen(eintraege: readonly Reagenzeintrag[]): Reagenzzeile[] {
    return eintraege.map((entry) => ({
      reagenz: this.i18n.translate(REAGENZ_TEXT[entry.reagenz]),
      reaktion: entry.reaktion,
    }));
  }

  private essbar(value: Species['speisewert']): Marke {
    return { text: this.i18n.translate(EDIBILITY_TEXT[value]), variant: EDIBILITY_BADGE[value] };
  }
}
