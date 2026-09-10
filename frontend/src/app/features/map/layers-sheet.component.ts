import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BACKGROUNDS, backgroundAvailable, type Background } from '../../map/background';
import { ActionBarComponent, ListRowComponent, SheetComponent, SliderComponent } from '../../ui';

interface BackgroundChoice {
  value: Background;
  label: string;
  subline?: string;
  available: boolean;
}

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
    ListRowComponent,
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

  protected readonly choices = computed<BackgroundChoice[]>(() =>
    BACKGROUNDS.map((value) => ({
      value,
      label: this.i18n.translate(`hintergrund.${value}`),
      subline: backgroundAvailable(value) ? undefined : this.i18n.translate('hintergrund.spaeter'),
      available: backgroundAvailable(value),
    })),
  );

  protected readonly percent = computed(() => Math.round(this.opacity() * 100));

  protected readonly percentText = computed(() =>
    this.i18n.translate('karte.prozent', { wert: this.percent() }),
  );

  protected onOpacity(percent: number): void {
    this.opacityChange.emit(percent / 100);
  }
}
