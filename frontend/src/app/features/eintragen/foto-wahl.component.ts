import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import { FOTOS_JE_FUND } from '../../core/api/eintraege.api';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../../ui';

/** Ein gewähltes Bild mit seiner Vorschau-Adresse. */
interface Vorschau {
  datei: File;
  url: string;
  beschriftung: string;
  entfernen: string;
}

/**
 * Die Fotos eines Fundes vor dem Senden: bis zu drei aus Kamera oder Galerie,
 * mit Vorschau und Entfernen.
 *
 * Das Verkleinern und das Löschen der EXIF-Daten macht der Server. Die
 * Vorschau entsteht aus einer Objekt-Adresse; sie wird wieder freigegeben,
 * sobald das Bild nicht mehr in der Liste steht.
 */
@Component({
  selector: 'app-foto-wahl',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './foto-wahl.component.html',
  styleUrl: './foto-wahl.component.scss',
})
export class FotoWahlComponent implements OnDestroy {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  readonly dateien = input.required<readonly File[]>();

  readonly dateienChange = output<readonly File[]>();

  protected readonly hoechstens = FOTOS_JE_FUND;
  /** Die Adressen, die noch freigegeben werden müssen. */
  private readonly offen = new Map<File, string>();

  protected readonly vorschauen = computed<Vorschau[]>(() => {
    const dateien = this.dateien();
    for (const [datei, url] of this.offen) {
      if (!dateien.includes(datei)) {
        URL.revokeObjectURL(url);
        this.offen.delete(datei);
      }
    }
    return dateien.map((datei, index) => {
      const url = this.offen.get(datei) ?? URL.createObjectURL(datei);
      this.offen.set(datei, url);
      return {
        datei,
        url,
        beschriftung: this.i18n.translate('melden.fotoVorschau', { nummer: index + 1 }),
        entfernen: this.i18n.translate('melden.fotoEntfernen', { nummer: index + 1 }),
      };
    });
  });

  protected readonly voll = computed(() => this.dateien().length >= FOTOS_JE_FUND);

  ngOnDestroy(): void {
    for (const url of this.offen.values()) URL.revokeObjectURL(url);
    this.offen.clear();
  }

  protected beiWahl(ereignis: Event): void {
    const feld = ereignis.target as HTMLInputElement;
    const gewaehlt = Array.from(feld.files ?? []);
    // Das Feld wird geleert, sonst löste dieselbe Datei beim nächsten Mal kein
    // Ereignis aus.
    feld.value = '';
    if (gewaehlt.length === 0) return;
    const frei = FOTOS_JE_FUND - this.dateien().length;
    if (gewaehlt.length > frei) this.toasts.error(this.i18n.translate('melden.fotosVoll'));
    this.dateienChange.emit([...this.dateien(), ...gewaehlt.slice(0, frei)]);
  }

  protected entferne(datei: File): void {
    this.dateienChange.emit(this.dateien().filter((kandidat) => kandidat !== datei));
  }
}
