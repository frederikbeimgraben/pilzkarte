import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent } from '@stupa-makers/ui-kit';
import type {
  Species,
  Entwicklung,
  Farbe,
  Reagenzeintrag,
  SeasonCurveData,
  Link,
  TaxonStep,
} from '../../core/api/models';
import { TIER_WEAKEST } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ActionBarComponent,
  ColourChangeComponent,
  ColourFieldComponent,
  KeyValueRowComponent,
  EmptyStateComponent,
  InfoTextComponent,
  KeyValueTableComponent,
  LevelPillComponent,
  LookalikeRowComponent,
  MeasurementComponent,
  NoteComponent,
  PageHeaderComponent,
  SeasonCurveComponent,
  SvgIconComponent,
  TagListComponent,
  YearBandComponent,
  type MonthMark,
} from '../../ui';
import {
  changeRow,
  colourRow,
  colourRows,
  levelRows,
  measureRows,
  senseRows,
  timeRow,
  type ChangeRow,
  type ColourRow,
  type LevelRow,
  type Marke,
  type MeasureRow,
  type SenseRow,
  type TimeRow,
} from './feature-rows';
import { SpeciesImagesComponent } from './species-images.component';
import { longDate } from '../../core/i18n/dates';
import { SpeciesState } from './species.state';
import { MapState } from '../map/map.state';
import { FORECAST_SLUGS, type ForecastSlug } from '../../core/tiles/tile-paths';
import { RANK_TEXT } from '../taxonomy/labels';
import {
  ATTACHMENT_TEXT,
  CAP_FEATURE_TEXT,
  CAP_MARGIN_TEXT,
  CAP_SHAPE_TEXT,
  EDGE_TEXT,
  EDIBILITY_BADGE,
  EDIBILITY_TEXT,
  GEFAEHRDUNG_TEXT,
  HAEUFIGKEIT_TEXT,
  HYMENOPHORE_TEXT,
  FEATURE_TEXT,
  REAGENZ_TEXT,
  LEVEL_BADGE,
  SPACING_TEXT,
  STEM_FEATURE_TEXT,
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
  badge: Marke;
  /** Der Weg zum Profil der anderen Art. Jedes Paar zeigt auf ein Profil. */
  route: string;
  /** Der Weg zur Gegenüberstellung beider Arten. */
  vergleich: string;
  /** Die Hutfarben des Partners. Leer, wo die Quelle keine nennt. */
  farben: Farbe[];
  /** Die Beschriftung des Farbfelds für Hilfsmittel. */
  farbenLabel: string;
}

/** Eine Zeile der Fruchtschicht: das Wort links, der Wert rechts. */
interface LayerRow {
  schluessel: string;
  wert: string;
}

interface Reagenzzeile {
  reagenz: string;
  reaktion: string;
}

/** Die Artseite, fertig für die Vorlage. */
/** Eine Stufe der Einordnung, wie die Artseite sie verlinkt. */
interface TaxonRow {
  name: string;
  rank: string;
  latin: string | null;
  route: string;
}

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
  einstufung: LevelRow[];
  masse: MeasureRow[];
  fruchtschicht: LayerRow[];
  hut: LayerRow[];
  stiel: LayerRow[];
  sporenlager: ColourRow | null;
  farben: ColourRow[];
  verfaerbung: ChangeRow | null;
  zeit: TimeRow | null;
  sinne: SenseRow[];
  merkmale: FeatureRow[];
  reagenzien: Reagenzzeile[];
  verwechslungen: ConfusableRow[];
  taxonomie: TaxonRow[];
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
    ColourChangeComponent,
    ColourFieldComponent,
    KeyValueRowComponent,
    EmptyStateComponent,
    InfoTextComponent,
    KeyValueTableComponent,
    LevelPillComponent,
    LookalikeRowComponent,
    MeasurementComponent,
    NoteComponent,
    PageHeaderComponent,
    SeasonCurveComponent,
    SpeciesImagesComponent,
    SvgIconComponent,
    TagListComponent,
    TranslatePipe,
    YearBandComponent,
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
    if (art.schutz.status !== 'keiner') {
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
      einstufung: levelRows(this.i18n, art),
      masse: measureRows(this.i18n, art.masse),
      fruchtschicht: this.layerRows(art),
      hut: this.capRows(art),
      stiel: this.stemRows(art),
      sporenlager: colourRow(this.i18n, 'sporenlager', 'art.zeile.sporenlagerFarbe', art.farben),
      farben: colourRows(this.i18n, art.farben),
      verfaerbung: changeRow(this.i18n, art.farben),
      zeit: timeRow(this.i18n, art),
      sinne: senseRows(this.i18n, art),
      merkmale: this.featureRows(art, reagenzien.length > 0),
      reagenzien,
      verwechslungen: art.verwechslungen.map((confusable) => ({
        name: confusable.name,
        lateinisch: confusable.lateinisch,
        badge: this.essbar(confusable.speisewert),
        route: `/arten/${confusable.slug}`,
        vergleich: `/arten/${art.slug}/vergleich/${confusable.slug}`,
        farben: confusable.hutFarben,
        farbenLabel: this.i18n.translate('art.farbe.beschriftung', {
          farben: confusable.hutFarben.map((farbe) => farbe.name).join(', '),
        }),
      })),
      taxonomie: art.taxonomie.map((step) => this.taxonRow(step)),
      links: art.links,
      geprueft: this.i18n.translate('art.geprueft', {
        datum: longDate(art.quelle.geprueftAm, this.i18n.locale()),
      }),
      kartenSlug: art.kartenSlug,
      woche: saison?.stand.woche ?? 0,
    };
  }

  private taxonRow(step: TaxonStep): TaxonRow {
    return {
      name: step.name,
      rank: this.i18n.translate(RANK_TEXT[step.rang]),
      // Der lateinische Name steht nur, wo er nicht schon der Name ist.
      latin: step.lateinisch === step.name ? null : step.lateinisch,
      route: `/taxonomie/${step.rang}/${step.slug}`,
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
    rows.push(...this.namenzeilen(art));
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

  /**
   * Die Fruchtschicht: Art, dazu Ansatz, Stand und Schneide.
   *
   * Kein Zeichen, nur das Wort. Der Sachverhalt lässt sich bei 24 px nicht
   * zeichnen, ohne zu verschwimmen. Die drei Zeilen nach der Art gibt es nur
   * an Lamellen; Röhren, Stacheln und Leisten tragen sie nicht.
   */
  private layerRows(art: Species): LayerRow[] {
    const layer = art.fruchtschicht;
    if (layer === null) return [];
    const rows: LayerRow[] = [
      {
        schluessel: this.i18n.translate('art.zeile.fruchtschichtart'),
        wert: this.i18n.translate(HYMENOPHORE_TEXT[layer.art]),
      },
    ];
    if (layer.ansatz !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.zeile.ansatz'),
        wert: this.i18n.translate(ATTACHMENT_TEXT[layer.ansatz]),
      });
    }
    if (layer.stand !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.zeile.stand'),
        wert: this.i18n.translate(SPACING_TEXT[layer.stand]),
      });
    }
    if (layer.schneide !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.zeile.schneide'),
        wert: this.i18n.translate(EDGE_TEXT[layer.schneide]),
      });
    }
    return rows;
  }

  /**
   * Form, Merkmale und Rand des Hutes, jeweils als Wort.
   *
   * Die Form ist eine Entwicklung: „gewölbt, später flach". Wo die Quelle
   * keine Veränderung nennt, steht nur der erste Wert.
   */
  private capRows(art: Species): LayerRow[] {
    const rows: LayerRow[] = [];
    if (art.hutform !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.zeile.hutform'),
        wert: this.development(art.hutform, (value) => this.i18n.translate(CAP_SHAPE_TEXT[value])),
      });
    }
    if (art.hutmerkmale.length > 0) {
      rows.push({
        schluessel: this.i18n.translate('art.zeile.hutmerkmale'),
        wert: art.hutmerkmale.map((feature) => this.i18n.translate(CAP_FEATURE_TEXT[feature])).join(', '),
      });
    }
    if (art.hutrand !== null) {
      rows.push({
        schluessel: this.i18n.translate('art.zeile.hutrand'),
        wert: this.development(art.hutrand, (values) =>
          values.map((value) => this.i18n.translate(CAP_MARGIN_TEXT[value])).join(', '),
        ),
      });
    }
    return rows;
  }

  /** Was der Stiel trägt. Mehreres zugleich, darum eine Liste. */
  private stemRows(art: Species): LayerRow[] {
    if (art.stielmerkmale.length === 0) return [];
    return [
      {
        schluessel: this.i18n.translate('art.zeile.stielmerkmale'),
        wert: art.stielmerkmale.map((feature) => this.i18n.translate(STEM_FEATURE_TEXT[feature])).join(', '),
      },
    ];
  }

  /** „gewölbt, später flach" — oder nur der erste Wert, wo nichts folgt. */
  private development<T>(entwicklung: Entwicklung<T>, wort: (value: T) => string): string {
    const von = wort(entwicklung.von);
    if (entwicklung.nach === null) return von;
    return this.i18n.translate('art.entwicklung', { von, nach: wort(entwicklung.nach) });
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
