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
  OBJEKT_FARBEN,
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
  type Raste,
} from '../../ui';
import {
  BEISPIEL_ALLE_JAHRE,
  BEISPIEL_HISTOGRAMM,
  BEISPIEL_LAUFENDES_JAHR,
  BEISPIEL_WOCHEN,
} from './beispiel-daten';

/**
 * Die Werkstattseite: jeder gemeinsame Baustein einmal, links hell und rechts
 * dunkel. Sie gibt es nur in der Entwicklung (siehe `app.routes.ts`).
 *
 * Die Themes stehen nebeneinander, indem die Seite die beiden Theme-Regeln des
 * ui-kits zur Laufzeit aus dem Stilblatt liest und auf die Felder legt. So
 * bleibt hier keine zweite Kopie der Palette liegen, die veralten könnte.
 */
@Component({
  selector: 'app-bausteine',
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
  templateUrl: './bausteine.component.html',
  styleUrl: './bausteine.component.scss',
})
export class BausteineComponent {
  private readonly i18n = inject(I18nService);
  private readonly hellFeld = viewChild.required<ElementRef<HTMLElement>>('hell');
  private readonly dunkelFeld = viewChild.required<ElementRef<HTMLElement>>('dunkel');

  protected readonly wochen = BEISPIEL_WOCHEN;
  protected readonly alleJahre = BEISPIEL_ALLE_JAHRE;
  protected readonly laufendesJahr = BEISPIEL_LAUFENDES_JAHR;
  protected readonly histogramm = BEISPIEL_HISTOGRAMM;

  protected readonly aktiveWoche = signal({ jahr: 2025, woche: 40 });
  protected readonly raste = signal<Raste>(1);
  protected readonly darstellung = signal('ebene');
  protected readonly chip = signal('alle');
  protected readonly faktorAktiv = signal(true);
  protected readonly von = signal(80);
  protected readonly bis = signal(240);
  protected readonly farbe = signal(OBJEKT_FARBEN[0]);
  protected readonly notizWert = signal('');

  constructor() {
    afterNextRender(() => {
      this.themenAuftragen();
    });
  }

  protected readonly navEintraege = [
    { pfad: '/karte', label: this.text('nav.karte'), icon: 'karte' as const },
    { pfad: '/arten', label: this.text('nav.arten'), icon: 'arten' as const },
    { pfad: '/eintraege', label: this.text('nav.eintraege'), icon: 'funde' as const },
  ];

  protected readonly darstellungen = [
    { wert: 'vorhersage', label: this.text('beispiel.darstellung.vorhersage') },
    { wert: 'ebene', label: this.text('beispiel.darstellung.ebene') },
    { wert: 'kombination', label: this.text('beispiel.darstellung.kombination') },
  ];

  protected readonly chips = [
    { wert: 'alle', label: this.text('beispiel.chip.alle') },
    { wert: 'vorhersage', label: this.text('beispiel.chip.mitVorhersage') },
    { wert: 'roehrlinge', label: this.text('beispiel.chip.roehrlinge') },
    { wert: 'herbst', label: this.text('beispiel.chip.herbst') },
  ];

  protected readonly farben = OBJEKT_FARBEN.map((wert, i) => ({
    wert,
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
  private themenAuftragen(): void {
    let hell = '';
    let dunkel = '';
    for (const blatt of Array.from(document.styleSheets)) {
      let regeln: CSSRuleList;
      try {
        regeln = blatt.cssRules;
      } catch {
        continue;
      }
      for (const regel of Array.from(regeln)) {
        if (!(regel instanceof CSSStyleRule) || !regel.selectorText.includes('data-theme')) continue;
        if (regel.selectorText.includes('dark')) dunkel += regel.style.cssText;
        else if (regel.selectorText.includes('light')) hell += regel.style.cssText;
      }
    }
    this.hellFeld().nativeElement.style.cssText = hell;
    this.dunkelFeld().nativeElement.style.cssText = dunkel;
  }
}
