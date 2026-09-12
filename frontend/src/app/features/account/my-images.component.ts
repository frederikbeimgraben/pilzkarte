import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import type { ImageState, ImageSubmission } from '../../core/api/models';
import { SpeciesImagesApi } from '../../core/api/species-images.api';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { EmptyStateComponent, NoteComponent, PageHeaderComponent, PrivateImageComponent } from '../../ui';
import { SpeciesState } from '../species/species.state';

const STATE_BADGE: Record<ImageState, BadgeVariant> = {
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const STATE_TEXT: Record<ImageState, TranslationKey> = {
  submitted: 'bild.zustand.inPruefung',
  approved: 'bild.zustand.freigegeben',
  rejected: 'bild.zustand.abgelehnt',
};

/** Eine Einreichung, fertig für die Vorlage. */
interface Row {
  id: string;
  species: string;
  thumbPath: string;
  alt: string;
  submitted: string;
  badge: BadgeVariant;
  badgeText: string;
  reason: string | null;
}

/**
 * „Meine Bilder“ unter dem Konto (Artboard `Einreichungen`): je Einreichung
 * ihr Zustand, bei einer Absage der Grund.
 *
 * Bis zur Freigabe sieht das Bild nur, wer es eingereicht hat. Es kommt darum
 * über den angemeldeten Weg und nicht als nacktes `src`.
 */
@Component({
  selector: 'app-my-images',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    CardComponent,
    EmptyStateComponent,
    NoteComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    TranslatePipe,
  ],
  templateUrl: './my-images.component.html',
  styleUrl: './my-images.component.scss',
})
export class MyImagesComponent {
  private readonly api = inject(SpeciesImagesApi);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly species = inject(SpeciesState);

  private readonly held = signal<readonly ImageSubmission[] | null>(null);

  protected readonly loaded = computed(() => this.held() !== null);
  protected readonly rows = computed<Row[]>(() =>
    (this.held() ?? []).map((image) => {
      const name = this.species.nameOf(image.speciesSlug) ?? image.speciesSlug;
      return {
        id: image.id,
        species: name,
        thumbPath: image.thumbUrl,
        alt: image.caption ?? this.i18n.translate('bild.von', { name }),
        submitted: this.i18n.translate('bild.eingereichtAm', {
          datum: longDate(image.submittedAt.slice(0, 10), this.i18n.locale()),
        }),
        badge: STATE_BADGE[image.state],
        badgeText: this.i18n.translate(STATE_TEXT[image.state]),
        reason: image.rejectReason,
      };
    }),
  );

  constructor() {
    this.species.loadAll();
    this.api.mine().subscribe({
      next: (page) => {
        this.held.set(page.eintraege);
      },
      error: () => {
        this.held.set([]);
      },
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }
}
