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
import { ButtonComponent, SelectComponent, ToastService } from '@stupa-makers/ui-kit';
import { LICENCES, type Licence } from '../../core/api/models';
import { COARSE_DIGITS, GRID_KM } from '../../core/location/grid';
import { LocationService } from '../../core/location/location.service';
import { SpeciesImagesApi, type ImageInput } from '../../core/api/species-images.api';
import { PermissionsService } from '../../core/access/permissions.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { locationText } from '../../core/i18n/places';
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
    ButtonComponent,
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
  private readonly locating = inject(LocationService);
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
  protected readonly place = signal<readonly [number, number] | null>(null);
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

  /**
   * Zu einer streng geschützten Art wird der Ort gar nicht erst angeboten.
   * Schon die Gegend wäre ein Hinweis, den niemand geben soll. Solange das
   * Profil fehlt, bleibt das Feld weg: im Zweifel kein Ort.
   */
  protected readonly offersPlace = computed(() => {
    const brief = this.species.briefOf(this.slug());
    return brief !== null && brief.schutz.status !== 'strengGeschuetzt';
  });

  /** Ohne Freigabe steht der Knopf nicht da, statt ins Leere zu greifen. */
  protected readonly mayLocate = this.locating.allowed;

  /** Der gewählte Ort, wie ihn eine Person liest. */
  protected readonly placeText = computed(() => {
    const point = this.place();
    if (point === null) return null;
    const [lon, lat] = point;
    const shown = locationText(lat, lon, this.i18n.locale(), COARSE_DIGITS);
    return this.i18n.translate('bild.ortGerundet', {
      lat: shown.lat,
      lon: shown.lon,
      km: GRID_KM,
    });
  });
  protected readonly ready = computed(() => this.file() !== null && this.photographer().trim().length > 0);

  constructor() {
    effect(() => {
      // Der Katalog nennt Namen und Schutz. Beides braucht diese Seite, und
      // ein zweiter Weg über das Profil wäre eine Anfrage zu viel.
      this.species.loadAll();
      // Der Dienst hält einen Beobachter für die ganze App; ein zweiter Anstoß
      // kostet keine zweite Ortung.
      this.locating.start();
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

  protected takePlace(): void {
    const own = this.locating.location();
    if (own === null) {
      this.toasts.error(this.i18n.translate('bild.ortFehler'));
      return;
    }
    this.place.set([own.lon, own.lat]);
  }

  protected dropPlace(): void {
    this.place.set(null);
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
    // Der Ort geht so genau hinaus, wie das Gerät ihn kennt; gerundet wird er
    // im Dienst. Nur so kommt der genaue Wert nirgends in eine Datenbank.
    const point = this.offersPlace() ? this.place() : null;
    return {
      speciesSlug: this.slug(),
      photographer: this.photographer().trim(),
      licence: this.licence(),
      ...(source.length > 0 ? { source } : {}),
      ...(takenOn.length > 0 ? { takenOn } : {}),
      ...(caption.length > 0 ? { caption } : {}),
      ...(point === null ? {} : { lon: point[0], lat: point[1] }),
    };
  }

  /** Eine Objekt-URL bleibt sonst im Speicher, bis die Seite neu lädt. */
  private release(): void {
    const held = this.preview();
    if (held !== null) URL.revokeObjectURL(held);
    this.preview.set(null);
  }
}
