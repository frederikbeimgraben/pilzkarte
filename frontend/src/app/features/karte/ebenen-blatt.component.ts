import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { HINTERGRUENDE, hintergrundVerfuegbar, type Hintergrund } from '../../map/hintergrund';
import { ActionBarComponent, ListRowComponent, SheetComponent, SliderComponent } from '../../ui';

interface HintergrundWahl {
  wert: Hintergrund;
  label: string;
  unter?: string;
  verfuegbar: boolean;
}

/**
 * Was auf der Karte liegt, unabhängig von der Darstellung: Hintergrund,
 * Deckkraft der Wertebene und, in der Darstellung Ebene, die Vorhersage
 * darunter. Marker und Zonen kommen später dazu.
 */
@Component({
  selector: 'app-ebenen-blatt',
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
  templateUrl: './ebenen-blatt.component.html',
  styleUrl: './ebenen-blatt.component.scss',
})
export class EbenenBlattComponent {
  private readonly i18n = inject(I18nService);

  readonly hintergrund = input.required<Hintergrund>();
  /** Deckkraft der Wertebene, 0 bis 1. */
  readonly deckkraft = input.required<number>();
  /** Nur in der Darstellung Ebene lässt sich die Vorhersage darunter legen. */
  readonly zeigtEbene = input(false);
  readonly vorhersageDarunter = input(false);

  readonly hintergrundChange = output<Hintergrund>();
  readonly deckkraftChange = output<number>();
  readonly vorhersageDarunterChange = output<boolean>();
  readonly schliessen = output();

  protected readonly wahlen = computed<HintergrundWahl[]>(() =>
    HINTERGRUENDE.map((wert) => ({
      wert,
      label: this.i18n.translate(`hintergrund.${wert}`),
      unter: hintergrundVerfuegbar(wert) ? undefined : this.i18n.translate('hintergrund.spaeter'),
      verfuegbar: hintergrundVerfuegbar(wert),
    })),
  );

  protected readonly prozent = computed(() => Math.round(this.deckkraft() * 100));

  protected readonly prozentText = computed(() =>
    this.i18n.translate('karte.prozent', { wert: this.prozent() }),
  );

  protected beiDeckkraft(prozent: number): void {
    this.deckkraftChange.emit(prozent / 100);
  }
}
