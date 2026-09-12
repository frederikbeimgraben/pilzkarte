import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { LICENCE_TEXT } from './licences';
import type { Licence } from '../../core/api/models';

/**
 * Die Herkunft eines Bildes in einer Zeile: „Foto: Marie Weber · CC BY-SA 4.0“.
 *
 * Sie steht am Bild und nicht im Kleingedruckten. Wer ein Bild weitergibt,
 * muss den Urheber nennen; das geht nur, wenn er neben dem Bild steht.
 */
@Component({
  selector: 'app-image-credit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-credit.component.html',
  styleUrl: './image-credit.component.scss',
})
export class ImageCreditComponent {
  private readonly i18n = inject(I18nService);

  readonly photographer = input.required<string>();
  readonly licence = input.required<Licence>();

  protected readonly text = computed(() =>
    this.i18n.translate('bild.herkunft', {
      photographer: this.photographer(),
      licence: this.i18n.translate(LICENCE_TEXT[this.licence()]),
    }),
  );
}
