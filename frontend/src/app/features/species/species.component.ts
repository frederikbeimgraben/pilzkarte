import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import type {
  Species,
  Farbe,
  Farben,
  Masse,
  Reagenzeintrag,
  SeasonCurveData,
  Spanne,
  Link,
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
  type Extent,
  type MonthMark,
} from '../../ui';
import { SpeciesImagesComponent } from './species-images.component';
import { longDate } from '../../core/i18n/dates';
import { SpeciesState } from './species.state';
import { MapState } from '../map/map.state';
import { FORECAST_SLUGS, type ForecastSlug } from '../../core/tiles/tile-paths';
import {
  CHANGE_SPEED_TEXT,
  EDIBILITY_BADGE,
  EDIBILITY_COLOUR,
  EDIBILITY_TEXT,
  GEFAEHRDUNG_TEXT,
  HAEUFIGKEIT_TEXT,
  FEATURE_TEXT,
  MONTH_NAMES,
  PROTECTION_BADGE,
  PROTECTION_TEXT,
  REAGENZ_TEXT,
  LEVEL_BADGE,
  TAG_TEXT,
  UNIT_TEXT,
  WARNUNG_TEXT,
  YEAR_MARKS,
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

/**
 * Die Maße in der Reihenfolge, in der die Artseite sie nennt. `extent` sagt,
 * welche Strecke gemessen wurde: das Zeichen davor trägt die Bedeutung, weil
 * ein Balken eine Skala zwischen Hut und Spore vortäuschte, die es nicht gibt.
 */
const MEASURE_ROWS: readonly {
  field: keyof Masse;
  schluessel: TranslationKey;
  unter: TranslationKey;
  extent: Extent;
}[] = [
  {
    field: 'hutBreiteCm',
    schluessel: 'art.mass.hut',
    unter: 'art.mass.unter.breite',
    extent: 'hutbreite',
  },
  {
    field: 'fruchtkoerperBreiteCm',
    schluessel: 'art.mass.fruchtkoerperBreite',
    unter: 'art.mass.unter.breite',
    extent: 'hutbreite',
  },
  {
    field: 'fruchtkoerperHoeheCm',
    schluessel: 'art.mass.fruchtkoerperHoehe',
    unter: 'art.mass.unter.hoehe',
    extent: 'stielhoehe',
  },
  {
    field: 'stielLaengeCm',
    schluessel: 'art.mass.stielLaenge',
    unter: 'art.mass.unter.hoehe',
    extent: 'stielhoehe',
  },
  {
    field: 'stielDickeCm',
    schluessel: 'art.mass.stielDicke',
    unter: 'art.mass.unter.dicke',
    extent: 'stieldicke',
  },
  {
    field: 'sporenLaengeUm',
    schluessel: 'art.mass.sporenLaenge',
    unter: 'art.mass.unter.laenge',
    extent: 'sporenlaenge',
  },
  {
    field: 'sporenBreiteUm',
    schluessel: 'art.mass.sporenBreite',
    unter: 'art.mass.unter.breite',
    extent: 'sporenlaenge',
  },
];

/** Die Farbzeilen der Artseite, in der Reihenfolge des Mockups. */
const COLOUR_ROWS: readonly { field: keyof Omit<Farben, 'verfaerbung'>; schluessel: TranslationKey }[] = [
  { field: 'hut', schluessel: 'art.farbe.hut' },
  { field: 'sporenlager', schluessel: 'art.farbe.sporenlager' },
  { field: 'stiel', schluessel: 'art.farbe.stiel' },
  { field: 'fleisch', schluessel: 'art.farbe.fleisch' },
  { field: 'sporenpulver', schluessel: 'art.farbe.sporenpulver' },
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

/** Eine Zeile der Einstufung: Speisewert als Stufe, Schutz und Handel als Marke. */
interface LevelRow {
  schluessel: string;
  pill: { text: string; colour: string } | null;
  badge: Marke | null;
}

/** Eine Zeile der Maße: Zeichen, Zahl, Einheit. */
interface MeasureRow {
  schluessel: string;
  unter: string | null;
  extent: Extent;
  von: number;
  bis: number;
  einheit: string;
  zeichen: string;
}

/** Eine Zeile der Farbtafel: das Wort links, die Fläche rechts. */
interface ColourRow {
  schluessel: string;
  unter: string;
  farben: Farbe[];
  label: string;
}

/** Die Verfärbung: von, Pfeil, nach, Dauer. */
interface ChangeRow {
  von: Farbe[];
  nach: Farbe[];
  vonLabel: string;
  nachLabel: string;
  dauer: string;
  pfeil: string;
}

/** Die Jahresbahn mit ihrem Satz darüber. */
interface TimeRow {
  text: string;
  label: string;
  von: number;
  bis: number;
  beobachtetVon: number | null;
  beobachtetBis: number | null;
  marken: string[];
}

/** Geruch oder Geschmack: Kategorien und der Satz daneben. */
interface SenseRow {
  schluessel: string;
  tags: string[];
  text: string | null;
  label: string;
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
  einstufung: LevelRow[];
  masse: MeasureRow[];
  farben: ColourRow[];
  verfaerbung: ChangeRow | null;
  zeit: TimeRow | null;
  sinne: SenseRow[];
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
      einstufung: this.levelRows(art),
      masse: this.measureRows(art.masse),
      farben: this.colourRows(art.farben),
      verfaerbung: this.changeRow(art.farben),
      zeit: this.timeRow(art),
      sinne: this.senseRows(art),
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
   * Speisewert, Schutz und Handel als feste Werte.
   *
   * Der Speisewert trägt seine eigene Farbe: nur so warnt die Stufe, bevor man
   * das Wort gelesen hat. Schutz und Handel sind Marken, keine Warnungen.
   */
  private levelRows(art: Species): LevelRow[] {
    const trade = art.marktfaehigkeit.marktfaehig ? 'art.handel.ja' : 'art.handel.nein';
    return [
      {
        schluessel: this.i18n.translate('art.zeile.speisewert'),
        pill: {
          text: this.i18n.translate(EDIBILITY_TEXT[art.speisewert]),
          colour: EDIBILITY_COLOUR[art.speisewert],
        },
        badge: null,
      },
      {
        schluessel: this.i18n.translate('art.zeile.schutz'),
        pill: null,
        badge: {
          text: this.i18n.translate(PROTECTION_TEXT[art.schutz.status]),
          variant: PROTECTION_BADGE[art.schutz.status],
        },
      },
      {
        schluessel: this.i18n.translate('art.zeile.handel'),
        pill: null,
        badge: { text: this.i18n.translate(trade), variant: 'neutral' },
      },
    ];
  }

  /**
   * Die Maße, jedes mit dem Zeichen seiner Strecke.
   *
   * Die Unterzeile steht nur, wo sie gebraucht wird: bei „Stiel“ zweimal, um
   * Höhe von Dicke zu trennen, und überall dort, wo die Quelle einen selteneren
   * Wert nennt.
   */
  private measureRows(masse: Masse): MeasureRow[] {
    const present = MEASURE_ROWS.flatMap((row) => {
      const span = masse[row.field];
      return span === null ? [] : [{ ...row, span }];
    });
    const names = present.map((row) => this.i18n.translate(row.schluessel));
    return present.map((row, index) => {
      const span = row.span;
      const unit = this.i18n.translate(UNIT_TEXT[span.einheit]);
      // Erst wenn zwei Zeilen gleich heißen, sagt die Unterzeile, welche
      // Strecke gemeint ist. Bei einem einzelnen „Hut“ wäre sie Beiwerk.
      const twice = names.filter((name) => name === names[index]).length > 1;
      const notes = [twice ? this.i18n.translate(row.unter) : null, this.rareNote(span, unit)].filter(
        (note): note is string => note !== null,
      );
      return {
        schluessel: names[index],
        unter: notes.length > 0 ? notes.join(' · ') : null,
        extent: row.extent,
        von: span.von,
        bis: span.bis,
        einheit: unit,
        zeichen: this.i18n.translate(`art.mass.zeichen.${row.extent}`),
      };
    });
  }

  /** Der Ausreißer der Quelle steht als Wort, nicht als zweite Zahl im Wert. */
  private rareNote(span: Spanne, unit: string): string | null {
    if (span.seltenBis !== null) {
      return this.i18n.translate('art.mass.seltenBis', { wert: span.seltenBis, einheit: unit });
    }
    if (span.seltenVon !== null) {
      return this.i18n.translate('art.mass.seltenVon', { wert: span.seltenVon, einheit: unit });
    }
    return null;
  }

  /** Die Farben je Körperteil. Ein Körperteil ohne Farbe steht nicht da. */
  private colourRows(farben: Farben): ColourRow[] {
    return COLOUR_ROWS.flatMap((row) => {
      const colours = farben[row.field];
      if (colours.length === 0) return [];
      const names = colours.map((colour) => colour.name).join(', ');
      return [
        {
          schluessel: this.i18n.translate(row.schluessel),
          unter: names,
          farben: colours,
          label: this.i18n.translate('art.farbe.beschriftung', { farben: names }),
        },
      ];
    });
  }

  /** Ohne Zielfarbe gibt es keine Verfärbung, nur eine Farbe, die bleibt. */
  private changeRow(farben: Farben): ChangeRow | null {
    const change = farben.verfaerbung;
    if (change === null) return null;
    const names = (colours: Farbe[]): string => colours.map((colour) => colour.name).join(', ');
    const label = (colours: Farbe[]): string =>
      this.i18n.translate('art.farbe.beschriftung', { farben: names(colours) });
    const speed = change.dauer === null ? 'art.verfaerbung.bleibt' : CHANGE_SPEED_TEXT[change.dauer];
    return {
      von: change.von,
      nach: change.nach,
      vonLabel: label(change.von),
      nachLabel: label(change.nach),
      dauer: this.i18n.translate(change.nach.length === 0 ? 'art.verfaerbung.bleibt' : speed),
      pfeil: this.i18n.translate('art.verfaerbung.pfeil'),
    };
  }

  /**
   * Die Jahresbahn: blass der Zeitraum der Quelle, kräftig die Monate, in denen
   * die Kurve mindestens halb so hoch steht wie im Jahresbesten.
   */
  private timeRow(art: Species): TimeRow | null {
    const period = art.zeitraum;
    if (period === null) return null;
    const observed = art.beobachteterZeitraum;
    const month = (number: number): string => this.i18n.translate(MONTH_NAMES[number - 1]);
    const words = {
      von: month(period.vonMonat),
      bis: month(period.bisMonat),
      vonBeobachtet: observed ? month(observed.vonMonat) : '',
      bisBeobachtet: observed ? month(observed.bisMonat) : '',
    };
    return {
      text: this.i18n.translate(observed ? 'art.zeit.beobachtet' : 'art.zeit.genannt', words),
      label: this.i18n.translate(observed ? 'art.zeit.bahnBeobachtet' : 'art.zeit.bahn', words),
      von: period.vonMonat,
      bis: period.bisMonat,
      beobachtetVon: observed?.vonMonat ?? null,
      beobachtetBis: observed?.bisMonat ?? null,
      marken: YEAR_MARKS.map((mark) => this.i18n.translate(mark)),
    };
  }

  /** Geruch und Geschmack: die Kategorien tragen den Filter, der Satz den Rest. */
  private senseRows(art: Species): SenseRow[] {
    return [
      { schluessel: 'art.zeile.geruch', sense: art.geruch },
      { schluessel: 'art.zeile.geschmack', sense: art.geschmack },
    ]
      .filter((row) => row.sense.tags.length > 0 || row.sense.text !== null)
      .map((row) => ({
        schluessel: this.i18n.translate(row.schluessel as TranslationKey),
        tags: row.sense.tags,
        text: row.sense.text,
        label: this.i18n.translate(row.schluessel as TranslationKey),
      }));
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
