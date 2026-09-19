import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { histogramFor, type Layer } from '../../core/tiles/layers';
import type { Combination } from '../../core/api/models';
import { LayerListComponent } from './layer-list.component';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { CombinationsComponent } from './combinations.component';
import { FactorSheetComponent } from './factor-sheet.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent, type Detent } from '../../ui/sheet/sheet.component';
import { SpeciesPickerComponent } from '../../ui/species-picker/species-picker.component';
import { DETENT_SIZES } from './map-surface';
import { MapView } from './map.view';
import type { Factor } from './factors';

/** Welches Blatt gerade über der Karte liegt. */
export type Overlay = 'species' | 'layer' | 'factors' | 'factor' | 'combinations' | 'save' | null;

/** Der Kopf des Modals am Rechner nennt, worum es geht. */
const TITLE: Partial<Record<NonNullable<Overlay>, TranslationKey>> = {
  species: 'map.species.choose',
  layer: 'map.tab.layer',
  combinations: 'map.combination.list',
  save: 'map.combination.save',
};

/** Ein Name braucht wenig Platz, jedes andere Blatt die ganze Höhe. */
export function overlayDetent(open: Overlay): Detent {
  return open === 'save' ? 1 : 2;
}

/** Die Blätter über der Karte. Über der Karte liegt immer nur eines. */
@Component({
  selector: 'app-map-overlays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CombinationsComponent,
    FactorSheetComponent,
    FormFieldComponent,
    LayerListComponent,
    NgTemplateOutlet,
    OverlayHostComponent,
    SheetComponent,
    SpeciesPickerComponent,
    TranslatePipe,
  ],
  templateUrl: './map-overlays.component.html',
  styleUrl: './map-overlays.component.scss',
})
export class MapOverlaysComponent {
  private readonly i18n = inject(I18nService);
  protected readonly wide = inject(ViewportService).wide;
  protected readonly view = inject(MapView);
  protected readonly state = this.view.state;
  protected readonly combination = this.view.combination;

  readonly open = input.required<Overlay>();
  /** Der Faktor, den das Blatt `Faktor` gerade bearbeitet. */
  readonly factor = input<Factor | null>(null);
  readonly closed = output();
  readonly factorApplied = output<Factor>();
  readonly factorRemoved = output<Factor>();
  readonly saved = output<string>();

  /** Ein Blatt über der Karte steht in derselben obersten Raste. */
  protected readonly detents = DETENT_SIZES;

  /** Der Name einer Kombination braucht wenig Platz, der Rest die ganze Höhe. */
  protected readonly detent = computed(() => overlayDetent(this.open()));

  /** Die Faktorwahl trägt ihr eigenes Blatt. Am Rechner steht der Faktor in der Spalte. */
  protected readonly shown = computed(
    () => this.open() !== null && this.open() !== 'factors' && !(this.wide() && this.open() === 'factor'),
  );

  protected readonly title = computed(() => {
    const open = this.open();
    const key = open === null ? undefined : TITLE[open];
    return key === undefined ? '' : this.i18n.translate(key);
  });

  protected readonly name = signal('');

  protected readonly factorLayer = computed<Layer | null>(() => {
    const factor = this.factor();
    return factor === null ? null : (this.view.sources().get(factor.source) ?? null);
  });

  protected readonly histogram = computed(() => {
    const layer = this.factorLayer();
    return layer === null ? null : histogramFor(layer, this.view.weekKey());
  });

  protected chooseSpecies(slug: string): void {
    this.state.species.set(slug);
    this.closed.emit();
  }

  protected chooseLayer(layer: Layer): void {
    this.state.layer.set(layer.id);
    this.closed.emit();
  }

  protected pick(combination: Combination): void {
    this.combination.pick(combination);
    this.closed.emit();
  }

  protected confirmName(): void {
    const name = this.name().trim();
    if (name === '') return;
    this.name.set('');
    this.saved.emit(name);
  }

  protected cancelName(): void {
    this.name.set('');
    this.closed.emit();
  }
}
