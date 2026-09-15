import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  InputComponent,
  SelectComponent,
  ToastComponent,
  ToastService,
  type BadgeVariant,
  type SelectOption,
} from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { WORKSHOP_TEXTS } from '../../core/i18n/workshop-texts';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ActionBarComponent,
  AddRowComponent,
  AvatarButtonComponent,
  BannerComponent,
  CheckRowComponent,
  ChipGroupComponent,
  ChoiceRowComponent,
  ColourChangeComponent,
  ColourFieldComponent,
  type ColourMode,
  type ColourValue,
  ColourPickerComponent,
  ColourSwatchesComponent,
  ConfirmDialogComponent,
  CrosshairComponent,
  EmptyStateComponent,
  EntryRowComponent,
  ErrorStateComponent,
  FactorRowComponent,
  FilterChipComponent,
  FilterSheetComponent,
  FloatingButtonComponent,
  FormFieldComponent,
  HistogramComponent,
  IconButtonComponent,
  ImageCreditComponent,
  ImageTileComponent,
  ImageViewerComponent,
  InfiniteListComponent,
  KeyValueRowComponent,
  KeyValueTableComponent,
  LevelPillComponent,
  ListRowComponent,
  MeasurementGroupComponent,
  NavComponent,
  ObjectMenuComponent,
  OverlayHostComponent,
  PageHeaderComponent,
  PhotoPickerComponent,
  PopoverComponent,
  PrivateImageComponent,
  ProgressComponent,
  RampComponent,
  RangeSliderComponent,
  RejectDialogComponent,
  ReviewQueueComponent,
  SearchFieldComponent,
  SeasonCurveComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  SkeletonComponent,
  SpeciesPickerComponent,
  SpeciesRowComponent,
  SplitLayoutComponent,
  StatRowComponent,
  SvgIconComponent,
  TagListComponent,
  TimelineComponent,
  YearBandComponent,
  YearBandInputComponent,
  OBJECT_COLOURS,
  type DetentSize,
  type ObjectMenuTarget,
  type PopoverAnchor,
} from '../../ui';
import {
  BRUISE_COLOURS,
  CAP_COLOURS,
  CAP_RARE_SPANS,
  CAP_WIDTH_SPANS,
  COLOUR_CODE,
  FLESH_COLOURS,
  GRADIENT_COLOURS,
  LATIN_NAMES,
  MULTI_COLOURS,
  CAP_GRADIENTS,
  CODE_COLOUR,
  PRESS_COLOURS,
  TRIPLE_COLOURS,
  TUBE_COLOURS,
  NEAREST_TONES,
  PICKER_TONE_KEYS,
  PICKER_TONES,
  SAMPLE_ALL_YEARS,
  SAMPLE_CURRENT_YEAR,
  SAMPLE_HISTOGRAM,
  SAMPLE_IMAGE,
  SAMPLE_IMAGE_LARGE,
  SAMPLE_IMAGE_PRIVATE,
  SAMPLE_PHOTO,
  SAMPLE_THUMBS,
  SPECIES_THUMBS,
  SAMPLE_WEEKS,
  SAMPLE_WEEKS_FLAT,
  STEM_HEIGHT_SPANS,
  STEM_THICKNESS_SPANS,
} from './sample-data';
import { photoPath } from '../../core/api/models';

const THEME_ATTRIBUTE = 'data-theme';
const DARK = 'dark';

/** Die Werkstattseite: eine Karte je Baustein, in der Reihenfolge des Boards. */
/** Eine Farbzelle des Vergleichs: ihre Töne und wie sie zu malen sind. */
interface CompareColour {
  readonly mode: ColourMode;
  readonly colours: readonly ColourValue[];
}

@Component({
  selector: 'app-building-blocks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ToastService],
  imports: [
    ActionBarComponent,
    AddRowComponent,
    AvatarButtonComponent,
    BadgeComponent,
    BannerComponent,
    ButtonComponent,
    CardComponent,
    CheckRowComponent,
    CheckboxComponent,
    ChipGroupComponent,
    ChoiceRowComponent,
    ColourChangeComponent,
    ColourFieldComponent,
    ColourPickerComponent,
    ColourSwatchesComponent,
    ConfirmDialogComponent,
    CrosshairComponent,
    EmptyStateComponent,
    EntryRowComponent,
    ErrorStateComponent,
    FactorRowComponent,
    FilterChipComponent,
    FilterSheetComponent,
    FloatingButtonComponent,
    FormFieldComponent,
    FormsModule,
    HistogramComponent,
    IconButtonComponent,
    ImageCreditComponent,
    ImageTileComponent,
    ImageViewerComponent,
    InfiniteListComponent,
    InputComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    LevelPillComponent,
    ListRowComponent,
    MeasurementGroupComponent,
    NavComponent,
    ObjectMenuComponent,
    OverlayHostComponent,
    PageHeaderComponent,
    PhotoPickerComponent,
    PopoverComponent,
    PopoverComponent,
    PrivateImageComponent,
    ProgressComponent,
    RampComponent,
    RangeSliderComponent,
    RejectDialogComponent,
    ReviewQueueComponent,
    SearchFieldComponent,
    SeasonCurveComponent,
    SegmentedComponent,
    SelectComponent,
    SheetComponent,
    SheetHeadComponent,
    SkeletonComponent,
    SpeciesPickerComponent,
    SpeciesRowComponent,
    SplitLayoutComponent,
    StatRowComponent,
    SvgIconComponent,
    TagListComponent,
    TimelineComponent,
    ToastComponent,
    TranslatePipe,
    YearBandComponent,
    YearBandInputComponent,
  ],
  templateUrl: './building-blocks.component.html',
  styleUrl: './building-blocks.component.scss',
})
export class BuildingBlocksComponent {
  private readonly i18n = inject(I18nService).addFallback(inject(WORKSHOP_TEXTS));

  protected readonly weeks = SAMPLE_WEEKS;

  protected readonly weeksFlat = SAMPLE_WEEKS_FLAT;
  protected readonly histogramm = SAMPLE_HISTOGRAM;
  protected readonly objectColors = OBJECT_COLOURS;
  protected readonly sampleImage = SAMPLE_IMAGE;
<<<<<<< HEAD
  protected readonly sampleImagePath = photoPath(SAMPLE_IMAGE.id, 'thumb');
=======
  protected readonly sampleImageLarge = SAMPLE_IMAGE_LARGE;
  protected readonly samplePrivate = SAMPLE_IMAGE_PRIVATE;
  protected readonly samplePhoto = SAMPLE_PHOTO;
>>>>>>> ea8e22d7 (fix(ui): zeichnet Platzhalter und Dialog wie das Board)
  protected readonly capColours = CAP_COLOURS;
  protected readonly gradientColours = GRADIENT_COLOURS;
  protected readonly multiColours = MULTI_COLOURS;
  protected readonly tripleColours = TRIPLE_COLOURS;
  protected readonly capWidthSpans = CAP_WIDTH_SPANS;
  protected readonly nearestTones = NEAREST_TONES;
  protected readonly colourCode = COLOUR_CODE;
  protected readonly codeColour = CODE_COLOUR;
  protected readonly reviewItems = LATIN_NAMES.map((latin) => ({
    latin,
    title: this.text('beispiel.pfifferling'),
    origin: this.text('beispiel.pruefung.herkunft'),
  }));
  protected readonly infiniteRows = LATIN_NAMES;

  protected readonly seasonSeries = [
    { shape: 'area' as const, values: SAMPLE_ALL_YEARS, legend: this.text('beispiel.kurve.jahre') },
    { shape: 'line' as const, values: SAMPLE_CURRENT_YEAR, legend: this.text('beispiel.kurve.laufend') },
  ];
  protected readonly seasonPlain = [
    { shape: 'area' as const, values: SAMPLE_ALL_YEARS },
    { shape: 'line' as const, values: SAMPLE_CURRENT_YEAR },
  ];

  protected readonly activeWeek = signal({ year: 2025, week: 40 });
  protected readonly viewMode = signal('ebene');
  protected readonly chip = signal<readonly string[]>(['steinpilz']);
  protected readonly checked = signal(true);
  protected readonly from = signal(84);
  protected readonly to = signal(240);
  protected readonly farbe = signal<string>(OBJECT_COLOURS[0]);
  protected readonly colourTone = signal<string | null>(PICKER_TONES[5]);
  protected readonly searchValue = signal(this.text('beispiel.suche.stein'));
  protected readonly yearFrom = signal(6);
  protected readonly yearTo = signal(10);
  protected readonly speciesChoice = signal<string | null>(null);
  protected readonly photoFiles = signal<readonly File[]>([this.sampleFile(0), this.sampleFile(1)]);
  protected readonly overlayOpen = signal(true);
  protected readonly filterSheetOpen = signal(true);

  protected readonly objectMenuTarget: ObjectMenuTarget = { x: 90, y: 60 };
  protected readonly popoverAnchor: PopoverAnchor = { top: 0, end: 0 };

  /** Das Board zeichnet die unterste Raste des Blatts 120 px hoch. */
  protected readonly sheetDetents: readonly [DetentSize, DetentSize, DetentSize] = ['320px', 0.4, 0.9];
  protected readonly navTabs = { map: '/karte', species: '/arten' };

  protected readonly badgeVariants: readonly { variant: BadgeVariant; label: string }[] = [
    { variant: 'neutral', label: this.text('beispiel.badge.neutral') },
    { variant: 'info', label: this.text('beispiel.badge.prognose') },
    { variant: 'success', label: this.text('beispiel.badge.gespeichert') },
    { variant: 'warning', label: this.text('beispiel.badge.geschuetzt') },
    { variant: 'danger', label: this.text('beispiel.badge.abgelehnt') },
  ];

  protected readonly fleshOptions: SelectOption[] = [
    { value: 'candidus', label: this.text('beispiel.farbe.fleisch') },
    { value: 'caeruleus', label: this.text('beispiel.farbe.blau') },
  ];

  protected readonly backgrounds = [
    { value: 'karte', label: this.text('map.basemap.map') },
    { value: 'hell', label: this.text('map.basemap.light') },
    { value: 'topo', label: this.text('map.basemap.topo') },
    { value: 'satellit', label: this.text('map.basemap.satellite') },
  ];

  protected readonly viewModes = [
    { value: 'vorhersage', label: this.text('map.tab.forecast') },
    { value: 'ebene', label: this.text('map.tab.layer') },
    { value: 'kombination', label: this.text('map.tab.combination') },
  ];

  protected readonly speciesChips = [
    { value: 'steinpilz', label: this.text('beispiel.steinpilz') },
    { value: 'birkenpilz', label: this.text('beispiel.birkenpilz') },
  ];

  protected readonly filterChips = [this.text('enum.edibility.edible'), this.text('enum.cap_shape.convex')];

  protected readonly colourSwatches = OBJECT_COLOURS.map((value, i) => ({
    value,
    label: `${this.text('common.colour')} ${String(i + 1)}`,
  }));

  protected readonly colourPickerSwatches = PICKER_TONES.map((value, i) => ({
    value,
    label: this.text(PICKER_TONE_KEYS[i]),
  }));

  protected readonly speciesRows = [
    {
      value: LATIN_NAMES[0],
      name: this.text('art.boletus_edulis'),
      latin: LATIN_NAMES[0],
      levelText: this.text('enum.edibility.edible'),
      levelColour: 'var(--color-success)',
      image: SPECIES_THUMBS.stein,
    },
    {
      value: LATIN_NAMES[4],
      name: this.text('beispiel.maronenroehrling'),
      latin: LATIN_NAMES[4],
      levelText: this.text('enum.edibility.edible'),
      levelColour: 'var(--color-success)',
      image: SPECIES_THUMBS.marone,
    },
  ];

  protected readonly pickerRows = [
    this.speciesRows[0],
    {
      value: LATIN_NAMES[1],
      name: this.text('beispiel.pfifferling'),
      latin: LATIN_NAMES[1],
      levelText: this.text('enum.edibility.edible'),
      levelColour: 'var(--color-success)',
      image: SPECIES_THUMBS.pfifferling,
    },
  ];

  protected readonly entries = [
    {
      title: this.text('beispiel.pfifferling'),
      meta: this.text('beispiel.fund.pfifferlingMeta'),
      note: this.text('beispiel.fund.pfifferlingNotiz'),
    },
    {
      title: this.text('art.boletus_edulis'),
      meta: this.text('beispiel.fund.steinpilzMeta'),
      note: this.text('beispiel.fund.steinpilzNotiz'),
    },
  ];

  protected readonly factor = {
    name: this.text('beispiel.faktor.niederschlag'),
    range: this.text('beispiel.faktor.niederschlagUnter'),
    condition: this.text('beispiel.faktor.niederschlagBedingung'),
  };

  protected readonly soilFactor = {
    name: this.text('map.factor.soilPh'),
    range: this.text('beispiel.faktor.bodenPhUnter'),
    condition: this.text('beispiel.faktor.bodenPhBedingung'),
  };

  protected readonly compareNames = [this.text('art.boletus_edulis'), this.text('beispiel.gallenroehrling')];

  /** Die Druckprobe der beiden Arten: erster Ton, dann der spätere. */
  protected readonly pressColours = PRESS_COLOURS;

  /** Eine Farbzelle des Vergleichs: ihre Töne und wie sie zu malen sind. */
  protected readonly compareColours: Record<string, readonly CompareColour[]> = {
    [this.text('beispiel.vergleich.hutfarbe')]: [
      { mode: 'gradient', colours: CAP_GRADIENTS[0] },
      { mode: 'gradient', colours: CAP_GRADIENTS[1] },
    ],
    [this.text('art.merkmal.roehren')]: [
      { mode: 'multiple', colours: TUBE_COLOURS[0] },
      { mode: 'single', colours: TUBE_COLOURS[1] },
    ],
  };

  protected readonly stats = [
    { value: 12, label: this.text('entry.finds') },
    { value: 4, label: this.text('entry.markers') },
    { value: 2, label: this.text('entry.zones') },
    { value: 3, label: this.text('entry.images') },
  ];

  protected readonly capRareMeasurement = [
    { extent: 'width' as const, spans: CAP_RARE_SPANS, unit: this.text('unit.cm') },
  ];

  protected readonly capMeasurements = [
    { extent: 'width' as const, spans: CAP_WIDTH_SPANS, unit: this.text('unit.cm') },
  ];

  protected readonly stemMeasurements = [
    { extent: 'height' as const, spans: STEM_HEIGHT_SPANS, unit: this.text('unit.cm') },
    { extent: 'thickness' as const, spans: STEM_THICKNESS_SPANS, unit: this.text('unit.cm') },
  ];

  protected readonly monthMarks = [
    { text: this.text('art.monat.jan'), week: 1 },
    { text: this.text('art.monat.apr'), week: 14 },
    { text: this.text('art.monat.jul'), week: 27 },
    { text: this.text('art.monat.okt'), week: 40 },
    { text: this.text('art.monat.dez'), week: 52 },
  ];

  protected readonly months = [
    this.text('art.monat.jan'),
    this.text('art.monat.apr'),
    this.text('art.monat.jul'),
    this.text('art.monat.okt'),
  ];

  protected readonly treeTags = [
    this.text('art.tag.fichte'),
    this.text('art.tag.buche'),
    this.text('beispiel.tag.herbst'),
  ];

  protected readonly colourChangeTriggers = [this.text('art.verfaerbung.zeile')];
  protected readonly colourChangeFrom = [FLESH_COLOURS];
  protected readonly colourChangeTo = [BRUISE_COLOURS];
  protected readonly colourChangeFromLabels = [this.text('art.farbe.fleisch')];
  protected readonly colourChangeToLabels = [this.text('art.abschnitt.farbe')];
  protected readonly colourChangeSpeed = [this.text('art.verfaerbung.schnell')];

  protected readonly splitRailLabel = this.text('nav.tab.species');
  protected readonly splitContentText = this.text('species.notFound');

  constructor() {
    const root = document.documentElement;
    const before = root.getAttribute(THEME_ATTRIBUTE);
    root.setAttribute(THEME_ATTRIBUTE, DARK);
    inject(DestroyRef).onDestroy(() => {
      if (before === null) root.removeAttribute(THEME_ATTRIBUTE);
      else root.setAttribute(THEME_ATTRIBUTE, before);
    });

    const toasts = inject(ToastService);
    toasts.show(this.text('beispiel.meldung.gespeichert'), 'success', 0);
    toasts.show(this.text('beispiel.meldung.fehlgeschlagen'), 'danger', 0);
  }

  protected text(schluessel: Parameters<I18nService['translate']>[0]): string {
    return this.i18n.translate(schluessel);
  }

  private sampleFile(index: number): File {
    const raw = atob(SAMPLE_THUMBS[index]);
    const bytes = Uint8Array.from(raw, (sign) => sign.charCodeAt(0));
    return new File([bytes], 'pilz.png', { type: 'image/png' });
  }
}
