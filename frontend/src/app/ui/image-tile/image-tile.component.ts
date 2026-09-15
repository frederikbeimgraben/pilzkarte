import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import { ImageCreditComponent } from '../image-credit/image-credit.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { photoPath, type Photo } from '../../core/api/models';

/** Eine Bildkachel mit Titelbild-Marke und Herkunftszeile. */
@Component({
  selector: 'app-image-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ImageCreditComponent, PrivateImageComponent, TranslatePipe],
  templateUrl: './image-tile.component.html',
  styleUrl: './image-tile.component.scss',
})
export class ImageTileComponent {
  readonly image = input.required<Photo>();
  /** Zeigt die Marke, wenn dieses Bild das Titelbild der Art ist. */
  readonly lead = input(false);

  protected readonly path = computed(() => photoPath(this.image().id, 'list'));
  protected readonly alt = computed(() => this.image().caption ?? this.image().photographer);
}
