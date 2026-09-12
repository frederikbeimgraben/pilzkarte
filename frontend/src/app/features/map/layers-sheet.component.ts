import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BACKGROUNDS, backgroundAvailable, type Background } from '../../map/background';
import {
  ActionBarComponent,
  NoteComponent,
  SegmentedComponent,
  SheetComponent,
  SliderComponent,
  type SegmentOption,
} from '../../ui';

/**
 * Was auf der Karte liegt, unabhängig von der Darstellung: Hintergrund,
 * Deckkraft der Wertebene, in der Darstellung Ebene die Vorhersage darunter,
 * und die eigenen Marker, Zonen und die geteilten Funde.
 */
@Component({
  selector: 'app-layers-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CheckboxComponent,
    FormsModule,
    NoteComponent,
    SegmentedComponent,
    SheetComponent,
    SliderComponent,
    TranslatePipe,
  ],
  templateUrl: './layers-sheet.component.html',
  styleUrl: './layers-sheet.component.scss',
})
export class LayersSheetComponent {
  private readonly i18n = inject(I18nService);

  readonly background = input.required<Background>();
  /** Deckkraft der Wertebene, 0 bis 1. */
  readonly opacity = input.required<number>();
  /** Nur in der Darstellung Ebene lässt sich die Vorhersage darunter legen. */
  readonly showsLayer = input(false);
  readonly forecastBelow = input(false);
  readonly showMarkers = input(true);
  readonly showZones = input(true);
  readonly showSharedFinds = input(true);

  readonly backgroundChange = output<Background>();
  readonly opacityChange = output<number>();
  readonly forecastBelowChange = output<boolean>();
  readonly showMarkersChange = output<boolean>();
  readonly showZonesChange = output<boolean>();
  readonly showSharedFindsChange = output<boolean>();
  readonly closed = output();

  /**
   * Nur die drei wählbaren Hintergründe stehen im Schalter. Topo und Satellit
   * wären dort tote Felder; sie stehen als Satz darunter.
   */
  protected readonly choices = computed<SegmentOption[]>(() => this.segment(backgroundAvailable));

  /**
   * Topo und Satellit stehen in einem eigenen, gesperrten Segment: sichtbar,
   * damit klar ist, was noch kommt, aber ohne Wirkung.
   */
  protected readonly later = computed<SegmentOption[]>(() =>
    this.segment((value) => !backgroundAvailable(value)),
  );

  private segment(nimm: (value: Background) => boolean): SegmentOption[] {
    return BACKGROUNDS.filter(nimm).map((value) => ({
      value,
      label: this.i18n.translate(`hintergrund.${value}`),
    }));
  }

  protected readonly percent = computed(() => Math.round(this.opacity() * 100));

  protected readonly percentText = computed(() =>
    this.i18n.translate('karte.prozent', { wert: this.percent() }),
  );

  protected chooseBackground(value: string): void {
    this.backgroundChange.emit(value as Background);
  }

  protected onOpacity(percent: number): void {
    this.opacityChange.emit(percent / 100);
  }
}
