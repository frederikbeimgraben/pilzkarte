import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { EmptyStateComponent, ImageCreditComponent, ImageViewerComponent } from '../../ui';
import type { SpeciesImage } from '../../core/api/models';

/**
 * Die Bilder einer Art: das Titelbild groß, die weiteren als Streifen
 * darunter, die Herkunft als Zeile am Bild. Ein Tipp öffnet das Bild groß.
 *
 * Ein freigegebenes Bild ist öffentlich. Es hängt darum als `src` am Bild und
 * nicht, wie ein Fundfoto, als Blob am Token.
 */
@Component({
  selector: 'app-species-images',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, ImageCreditComponent, ImageViewerComponent, TranslatePipe],
  templateUrl: './species-images.component.html',
  styleUrl: './species-images.component.scss',
})
export class SpeciesImagesComponent {
  private readonly i18n = inject(I18nService);

  readonly images = input.required<readonly SpeciesImage[]>();
  /** Der Name der Art. Er steht über dem großen Bild und in jeder Bildbeschreibung. */
  readonly speciesName = input.required<string>();

  protected readonly open = signal<SpeciesImage | null>(null);

  /** Das Titelbild. Das Backend stellt es an den Anfang der Liste. */
  protected readonly lead = computed<SpeciesImage | null>(() => this.images()[0] ?? null);
  protected readonly others = computed(() => this.images().slice(1));

  protected label(image: SpeciesImage): string {
    return image.caption ?? this.i18n.translate('bild.von', { name: this.speciesName() });
  }

  protected openLabel(image: SpeciesImage): string {
    return this.i18n.translate('bild.oeffnen', { description: this.label(image) });
  }

  protected show(image: SpeciesImage): void {
    this.open.set(image);
  }
}
