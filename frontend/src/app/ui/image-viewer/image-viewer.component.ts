import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { BadgeComponent, DialogComponent } from '@stupa-makers/ui-kit';
import { longDate } from '../../core/i18n/dates';
import { COARSE_DIGITS, GRID_KM } from '../../core/location/grid';
import { locationText } from '../../core/i18n/places';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LICENCE_TEXT } from '../image-credit/licences';
import { KeyValueRowComponent } from '../key-value-table/key-value-row.component';
import { KeyValueTableComponent } from '../key-value-table/key-value-table.component';
import type { SpeciesImage } from '../../core/api/models';

/** Eine Zeile der Tabelle unter dem großen Bild. */
interface Detail {
  label: string;
  text?: string;
  licence?: string;
}

/**
 * Ein Bild groß, darunter Fotograf, Lizenz, Aufnahmetag und Unterschrift.
 *
 * Der Rahmen ist der Dialog des Kits: er bringt Fokusfalle, Escape und die
 * Sperre des Hintergrunds schon mit.
 */
@Component({
  selector: 'app-image-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, DialogComponent, KeyValueRowComponent, KeyValueTableComponent, TranslatePipe],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.scss',
})
export class ImageViewerComponent {
  private readonly i18n = inject(I18nService);

  /** Das Bild. Ohne eines bleibt der Dialog zu. */
  readonly image = input.required<SpeciesImage | null>();
  /** Die Überschrift, meist der Name der Art. */
  readonly titel = input.required<string>();

  readonly closed = output();

  protected readonly alt = computed(() => {
    const image = this.image();
    if (image === null) return '';
    return image.caption ?? this.i18n.translate('bild.von', { name: this.titel() });
  });

  protected readonly details = computed<readonly Detail[]>(() => {
    const image = this.image();
    if (image === null) return [];
    const rows: Detail[] = [
      { label: this.i18n.translate('bild.foto'), text: image.photographer },
      {
        label: this.i18n.translate('bild.lizenz'),
        licence: this.i18n.translate(LICENCE_TEXT[image.licence]),
      },
    ];
    if (image.takenOn !== null) {
      rows.push({
        label: this.i18n.translate('bild.aufgenommen'),
        text: longDate(image.takenOn, this.i18n.locale()),
      });
    }
    if (image.caption !== null) {
      rows.push({ label: this.i18n.translate('bild.unterschrift'), text: image.caption });
    }
    if (image.source !== null) {
      rows.push({ label: this.i18n.translate('bild.quelle'), text: image.source });
    }
    if (image.lat !== null && image.lon !== null) {
      const shown = locationText(image.lat, image.lon, this.i18n.locale(), COARSE_DIGITS);
      rows.push({
        label: this.i18n.translate('bild.ort'),
        // Die Rundung steht am Ort und nicht im Kleingedruckten: eine Zahl
        // ohne ihre Genauigkeit liest sich genauer, als sie ist.
        text: this.i18n.translate('bild.ortGerundet', { lat: shown.lat, lon: shown.lon, km: GRID_KM }),
      });
    }
    return rows;
  });
}
