import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EntriesApi } from '../../core/api/entries.api';
import type { Photo } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';

/** Ein Bild, das schon geladen ist. */
interface Image {
  id: string;
  url: string;
  label: string;
}

/**
 * Die Fotos eines Fundes im Objekt-Blatt.
 *
 * Ein Foto hängt an den Rechten seines Fundes; der Server verlangt dafür das
 * Token. Ein `src` am Bild trüge keines, darum kommt jede Datei über den
 * ApiClient und wird als Objekt-Adresse eingehängt.
 */
@Component({
  selector: 'app-photo-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './photo-gallery.component.html',
  styleUrl: './photo-gallery.component.scss',
})
export class PhotoGalleryComponent implements OnDestroy {
  private readonly api = inject(EntriesApi);
  private readonly i18n = inject(I18nService);

  readonly findId = input.required<string>();
  readonly fotos = input.required<readonly Photo[]>();

  private readonly loaded = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly images = computed<Image[]>(() => {
    const urls = this.loaded();
    return this.fotos()
      .map((photo, index) => ({
        id: photo.id,
        url: urls.get(photo.id) ?? '',
        label: this.i18n.translate('melden.fotoVorschau', { nummer: index + 1 }),
      }))
      .filter((shot) => shot.url !== '');
  });

  constructor() {
    effect(() => {
      const findId = this.findId();
      for (const photo of this.fotos()) {
        if (!this.loaded().has(photo.id)) void this.get(findId, photo.id);
      }
    });
  }

  ngOnDestroy(): void {
    for (const url of this.loaded().values()) URL.revokeObjectURL(url);
  }

  private async get(findId: string, photoId: string): Promise<void> {
    try {
      const blob = await firstValueFrom(this.api.loadPhoto(findId, photoId));
      this.loaded.update((alt) => new Map(alt).set(photoId, URL.createObjectURL(blob)));
    } catch {
      // Ein Bild, das nicht kommt, bleibt weg. Der Fund steht auch ohne es.
    }
  }
}
