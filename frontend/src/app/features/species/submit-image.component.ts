import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SelectComponent, ToastService } from '@stupa-makers/ui-kit';
import { LICENCES, type Licence } from '../../core/api/models';
import { SpeciesImagesApi, type ImageInput } from '../../core/api/species-images.api';
import { PermissionsService } from '../../core/access/permissions.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ActionBarComponent,
  FormFieldComponent,
  LICENCE_TEXT,
  NoteComponent,
  PageHeaderComponent,
  SvgIconComponent,
} from '../../ui';
import { SpeciesState } from './species.state';

/**
 * Ein Bild zu einer Art einreichen (Artboards `Einreichen` und
 * `Hinzufuegen`).
 *
 * Jede angemeldete Person darf einreichen. Wer das Recht hat, Bilder
 * hochzuladen, stellt es sofort an die Art; der Knopf und der Hinweis sagen,
 * was gleich passiert. Entschieden wird das im Backend, hier steht nur der Text.
 *
 * Fotograf und Lizenz sind Pflicht. Ohne beides bleibt der Knopf zu.
 */
@Component({
  selector: 'app-submit-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    FormsModule,
    NoteComponent,
    PageHeaderComponent,
    SelectComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './submit-image.component.html',
  styleUrl: './submit-image.component.scss',
})
export class SubmitImageComponent implements OnDestroy {
  private readonly api = inject(SpeciesImagesApi);
  private readonly i18n = inject(I18nService);
  private readonly rights = inject(PermissionsService);
  private readonly router = inject(Router);
  private readonly species = inject(SpeciesState);
  private readonly toasts = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly photographer = signal('');
  protected readonly licence = signal<Licence>('own');
  protected readonly source = signal('');
  protected readonly takenOn = signal('');
  protected readonly caption = signal('');
  protected readonly busy = signal(false);

  /** Wer Bilder hochladen darf, umgeht die Prüfung. */
  protected readonly publishes = computed(() => this.rights.can('image.upload'));
  protected readonly speciesName = computed(() => this.species.nameOf(this.slug()) ?? this.slug());
  protected readonly titel = computed(() =>
    this.i18n.translate(this.publishes() ? 'bild.hinzufuegen' : 'bild.einreichen'),
  );
  protected readonly hint = computed(() =>
    this.i18n.translate(this.publishes() ? 'bild.hinweisSofort' : 'bild.hinweisPruefung'),
  );
  protected readonly action = computed(() =>
    this.i18n.translate(this.publishes() ? 'bild.speichern' : 'bild.abschicken'),
  );
  protected readonly licences = computed(() =>
    LICENCES.map((value) => ({ value, label: this.i18n.translate(LICENCE_TEXT[value]) })),
  );
  /** Eine Lizenz, die nicht der Person gehört, braucht die Herkunft dazu. */
  protected readonly needsSource = computed(() => this.licence() !== 'own');
  protected readonly ready = computed(() => this.file() !== null && this.photographer().trim().length > 0);

  constructor() {
    effect(() => {
      this.species.loadAll();
    });
  }

  ngOnDestroy(): void {
    this.release();
  }

  protected onPick(event: Event): void {
    const field = event.target as HTMLInputElement;
    const chosen = field.files?.[0] ?? null;
    // Das Feld wird geleert, sonst löste dieselbe Datei beim nächsten Mal kein
    // Ereignis aus.
    field.value = '';
    if (chosen === null) return;
    this.release();
    this.file.set(chosen);
    this.preview.set(URL.createObjectURL(chosen));
  }

  protected setLicence(value: string): void {
    this.licence.set(value as Licence);
  }

  protected save(): void {
    const file = this.file();
    if (file === null) {
      this.toasts.error(this.i18n.translate('bild.dateiFehlt'));
      return;
    }
    if (this.photographer().trim().length === 0) {
      this.toasts.error(this.i18n.translate('bild.fotografFehlt'));
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    const input = this.gather();
    const call = this.publishes() ? this.api.publish(input, file) : this.api.submit(input, file);
    call.subscribe({
      next: () => {
        this.toasts.success(this.i18n.translate(this.publishes() ? 'bild.gespeichert' : 'bild.eingereicht'));
        this.leave();
      },
      error: () => {
        this.busy.set(false);
      },
    });
  }

  protected leave(): void {
    void this.router.navigate(['/arten', this.slug()]);
  }

  private gather(): ImageInput {
    const source = this.source().trim();
    const takenOn = this.takenOn();
    const caption = this.caption().trim();
    return {
      speciesSlug: this.slug(),
      photographer: this.photographer().trim(),
      licence: this.licence(),
      ...(source.length > 0 ? { source } : {}),
      ...(takenOn.length > 0 ? { takenOn } : {}),
      ...(caption.length > 0 ? { caption } : {}),
    };
  }

  /** Eine Objekt-URL bleibt sonst im Speicher, bis die Seite neu lädt. */
  private release(): void {
    const held = this.preview();
    if (held !== null) URL.revokeObjectURL(held);
    this.preview.set(null);
  }
}
