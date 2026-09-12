import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, ButtonComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import { SpeciesImagesApi } from '../../core/api/species-images.api';
import type { ImageState, ImageSubmission } from '../../core/api/models';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  EmptyStateComponent,
  LICENCE_TEXT,
  NoteComponent,
  PageHeaderComponent,
  PrivateImageComponent,
  SegmentedComponent,
} from '../../ui';
import { SpeciesState } from '../species/species.state';
import { RejectDialogComponent } from './reject-dialog.component';

/** Die drei Sichten des Eingangs. Offen führt, dort liegt die Arbeit. */
const VIEWS: readonly { value: ImageState; label: TranslationKey }[] = [
  { value: 'submitted', label: 'bild.zustand.offen' },
  { value: 'approved', label: 'bild.zustand.freigegeben' },
  { value: 'rejected', label: 'bild.zustand.abgelehnt' },
];

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

/** Eine Aufgabe im Eingang, fertig für die Vorlage. */
interface Task {
  id: string;
  species: string;
  thumbPath: string;
  alt: string;
  subline: string;
  state: ImageState;
  badge: BadgeVariant;
  badgeText: string;
  reason: string | null;
  submittedBy: string | null;
}

/**
 * Der Eingang der Bildprüfung (Artboard `Freigabe`).
 *
 * Er ist eine Aufgabenliste und kein Raster: je Zeile ein Bild, daneben, was
 * man wissen muss, und rechts die beiden Knöpfe. Wer freigibt, arbeitet die
 * Liste von oben nach unten ab; ein Raster zwänge ihn, jedes Bild erst zu
 * öffnen.
 *
 * Ablehnen führt in ein eigenes Blatt, das nach dem Grund fragt. Ohne Grund
 * geht die Absage nicht hinaus.
 */
@Component({
  selector: 'app-admin-images',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    NoteComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    RejectDialogComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './images.component.html',
  styleUrl: './images.component.scss',
})
export class AdminImagesComponent {
  private readonly api = inject(SpeciesImagesApi);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly species = inject(SpeciesState);

  private readonly held = signal<readonly ImageSubmission[] | null>(null);
  private readonly busy = signal(false);

  protected readonly view = signal<ImageState>('submitted');
  /** Die Einreichung, deren Absage gerade nach einem Grund fragt. */
  protected readonly rejecting = signal<Task | null>(null);

  protected readonly loaded = computed(() => this.held() !== null);
  protected readonly options = computed(() =>
    VIEWS.map((entry) => ({ value: entry.value, label: this.i18n.translate(entry.label) })),
  );

  protected readonly tasks = computed<Task[]>(() =>
    (this.held() ?? []).map((image) => ({
      id: image.id,
      species: this.species.nameOf(image.speciesSlug) ?? image.speciesSlug,
      thumbPath: image.thumbUrl,
      alt:
        image.caption ??
        this.i18n.translate('bild.von', {
          name: this.species.nameOf(image.speciesSlug) ?? image.speciesSlug,
        }),
      subline: this.subline(image),
      state: image.state,
      badge: STATE_BADGE[image.state],
      badgeText: this.i18n.translate(STATE_TEXT[image.state]),
      reason: image.rejectReason,
      submittedBy: image.submittedBy,
    })),
  );

  constructor() {
    // Die Antwort nennt nur den Slug. Der Name steht im Katalog, und in der
    // Liste steht der Name.
    this.species.loadAll();
    this.load();
  }

  protected select(state: string): void {
    this.view.set(state as ImageState);
    this.held.set(null);
    this.load();
  }

  protected approve(task: Task): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.approve(task.id).subscribe({
      next: () => {
        this.after();
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }

  protected reject(reason: string): void {
    const task = this.rejecting();
    if (task === null || this.busy()) return;
    this.busy.set(true);
    this.rejecting.set(null);
    this.api.reject(task.id, reason).subscribe({
      next: () => {
        this.after();
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  private after(): void {
    this.busy.set(false);
    this.load();
  }

  private load(): void {
    this.api.submissions(this.view()).subscribe({
      next: (page) => {
        this.held.set(page.eintraege);
      },
      error: () => {
        this.held.set([]);
      },
    });
  }

  /**
   * Wer das Bild eingereicht hat und unter welchem Recht es steht. Wann jemand
   * es geprüft hat, steht hier nicht: für die Arbeit an der Liste sagt das
   * Datum nichts.
   */
  private subline(image: ImageSubmission): string {
    const licence = this.i18n.translate(LICENCE_TEXT[image.licence]);
    const person = image.submittedBy ?? this.i18n.translate('bild.unbekanntePerson');
    return this.i18n.translate('bild.eingereichtVon', {
      name: person,
      licence,
      datum: longDate(image.submittedAt.slice(0, 10), this.i18n.locale()),
    });
  }
}
