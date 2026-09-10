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
import { PHOTOS_PER_FIND } from '../../core/api/entries.api';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../../ui';

/** Ein gewähltes Bild mit seiner Vorschau-Adresse. */
interface Preview {
  file: File;
  url: string;
  label: string;
  remove: string;
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
  selector: 'app-photo-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './photo-picker.component.html',
  styleUrl: './photo-picker.component.scss',
})
export class PhotoPickerComponent implements OnDestroy {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  readonly files = input.required<readonly File[]>();

  readonly filesChange = output<readonly File[]>();

  protected readonly atMost = PHOTOS_PER_FIND;
  /** Die Adressen, die noch freigegeben werden müssen. */
  private readonly open = new Map<File, string>();

  protected readonly previews = computed<Preview[]>(() => {
    const files = this.files();
    for (const [file, url] of this.open) {
      if (!files.includes(file)) {
        URL.revokeObjectURL(url);
        this.open.delete(file);
      }
    }
    return files.map((file, index) => {
      const url = this.open.get(file) ?? URL.createObjectURL(file);
      this.open.set(file, url);
      return {
        file,
        url,
        label: this.i18n.translate('melden.fotoVorschau', { nummer: index + 1 }),
        remove: this.i18n.translate('melden.fotoEntfernen', { nummer: index + 1 }),
      };
    });
  });

  protected readonly full = computed(() => this.files().length >= PHOTOS_PER_FIND);

  ngOnDestroy(): void {
    for (const url of this.open.values()) URL.revokeObjectURL(url);
    this.open.clear();
  }

  protected onPick(event: Event): void {
    const field = event.target as HTMLInputElement;
    const selected = Array.from(field.files ?? []);
    // Das Feld wird geleert, sonst löste dieselbe Datei beim nächsten Mal kein
    // Ereignis aus.
    field.value = '';
    if (selected.length === 0) return;
    const free = PHOTOS_PER_FIND - this.files().length;
    if (selected.length > free) this.toasts.error(this.i18n.translate('melden.fotosVoll'));
    this.filesChange.emit([...this.files(), ...selected.slice(0, free)]);
  }

  protected remove(file: File): void {
    this.filesChange.emit(this.files().filter((candidate) => candidate !== file));
  }
}
