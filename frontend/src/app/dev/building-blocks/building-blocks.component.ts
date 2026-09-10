import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BadgeComponent, CardComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ActionBarComponent,
  ActionRowComponent,
  ActionSheetComponent,
  AvatarButtonComponent,
  BottomNavComponent,
  ChipGroupComponent,
  ColorSwatchesComponent,
  CrosshairComponent,
  FactorRowComponent,
  FloatingButtonComponent,
  FormFieldComponent,
  HistogramComponent,
  KeyValueRowComponent,
  KeyValueTableComponent,
  ListRowComponent,
  MetricRowComponent,
  NoteComponent,
  OBJECT_COLORS,
  PageHeaderComponent,
  RampComponent,
  RangeSliderComponent,
  SeasonCurveComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  SpeciesRowComponent,
  SvgIconComponent,
  TimelineComponent,
  type Detent,
} from '../../ui';
import { SAMPLE_ALL_YEARS, SAMPLE_HISTOGRAM, SAMPLE_CURRENT_YEAR, SAMPLE_WEEKS } from './sample-data';

/**
 * Die Werkstattseite: jeder gemeinsame Baustein einmal, links hell und rechts
 * dunkel. Sie gibt es nur in der Entwicklung (siehe `app.routes.ts`).
 *
 * Die Themes stehen nebeneinander, indem die Seite die beiden Theme-Regeln des
 * ui-kits zur Laufzeit aus dem Stilblatt liest und auf die Felder legt. So
 * bleibt hier keine zweite Kopie der Palette liegen, die veralten könnte.
 */
@Component({
  selector: 'app-building-blocks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ActionRowComponent,
    ActionSheetComponent,
    AvatarButtonComponent,
    BadgeComponent,
    BottomNavComponent,
    CardComponent,
    ChipGroupComponent,
    ColorSwatchesComponent,
    CrosshairComponent,
    FactorRowComponent,
    FloatingButtonComponent,
    FormFieldComponent,
    HistogramComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    ListRowComponent,
    MetricRowComponent,
    NgTemplateOutlet,
    NoteComponent,
    PageHeaderComponent,
    RampComponent,
    RangeSliderComponent,
    SeasonCurveComponent,
    SegmentedComponent,
    SheetComponent,
    SheetHeadComponent,
    SpeciesRowComponent,
    SvgIconComponent,
    TimelineComponent,
    TranslatePipe,
  ],
  templateUrl: './building-blocks.component.html',
  styleUrl: './building-blocks.component.scss',
})
export class BuildingBlocksComponent {
  private readonly i18n = inject(I18nService);
  private readonly lightPane = viewChild.required<ElementRef<HTMLElement>>('light');
  private readonly darkPane = viewChild.required<ElementRef<HTMLElement>>('dark');

  protected readonly wochen = SAMPLE_WEEKS;
  protected readonly alleJahre = SAMPLE_ALL_YEARS;
  protected readonly laufendesJahr = SAMPLE_CURRENT_YEAR;
  protected readonly histogramm = SAMPLE_HISTOGRAM;

  protected readonly activeWeek = signal({ jahr: 2025, woche: 40 });
  protected readonly detent = signal<Detent>(1);
  protected readonly viewMode = signal('ebene');
  protected readonly chip = signal('alle');
  protected readonly factorActive = signal(true);
  protected readonly von = signal(80);
  protected readonly bis = signal(240);
  protected readonly farbe = signal<string>(OBJECT_COLORS[0]);
  protected readonly noteValue = signal('');

  constructor() {
    afterNextRender(() => {
      this.applyTheme();
    });
  }

  protected readonly navEintraege = [
    { path: '/karte', label: this.text('nav.karte'), icon: 'karte' as const },
    { path: '/arten', label: this.text('nav.arten'), icon: 'arten' as const },
    { path: '/eintraege', label: this.text('nav.eintraege'), icon: 'funde' as const },
  ];

  protected readonly viewModes = [
    { value: 'vorhersage', label: this.text('beispiel.darstellung.vorhersage') },
    { value: 'ebene', label: this.text('beispiel.darstellung.ebene') },
    { value: 'kombination', label: this.text('beispiel.darstellung.kombination') },
  ];

  protected readonly chips = [
    { value: 'alle', label: this.text('beispiel.chip.alle') },
    { value: 'vorhersage', label: this.text('beispiel.chip.mitVorhersage') },
    { value: 'roehrlinge', label: this.text('beispiel.chip.roehrlinge') },
    { value: 'herbst', label: this.text('beispiel.chip.herbst') },
  ];

  protected readonly colors = OBJECT_COLORS.map((value, i) => ({
    value,
    label: `${this.text('farben.beschriftung')} ${i + 1}`,
  }));

  protected text(schluessel: Parameters<I18nService['translate']>[0]): string {
    return this.i18n.translate(schluessel);
  }

  /**
   * Kopiert die Theme-Regeln des Kits auf die beiden Felder. Fremde Stilblätter
   * sperren `cssRules`; die werden übersprungen, dann bleibt das Feld beim
   * Theme der App.
   */
  private applyTheme(): void {
    let light = '';
    let dark = '';
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || !rule.selectorText.includes('data-theme')) continue;
        if (rule.selectorText.includes('dark')) dark += rule.style.cssText;
        else if (rule.selectorText.includes('light')) light += rule.style.cssText;
      }
    }
    this.lightPane().nativeElement.style.cssText = light;
    this.darkPane().nativeElement.style.cssText = dark;
  }
}
