import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent, ToastService } from '@stupa-makers/ui-kit';
import type { SpeciesBrief, Find, FindInput, Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent, FormFieldComponent, NoteComponent, SegmentedComponent } from '../../ui';
import { SpeciesState } from '../species/species.state';
import { MapState } from '../map/map.state';
import { isoDatum, locationText } from '../entries/formats';
import { visibilitySegments } from './visibility';
import { SpeciesPickerComponent } from './species-picker.component';
import { PhotoPickerComponent } from './photo-picker.component';
import type { Location } from './add-entry.state';

/** Was das Formular abliefert: der Fund und seine noch nicht gesendeten Fotos. */
export interface FindSubmission {
  input: FindInput;
  fotos: readonly File[];
}

/**
 * Das Formular eines Fundes (Artboard `MeldenFormular`).
 *
 * Die Art ist die Art der Karte, solange niemand eine andere wählt; das Datum
 * ist heute. Das Formular prüft und gibt ab; ob daraus ein neuer Fund oder eine
 * Änderung wird, entscheidet, wer es einsetzt.
 */
@Component({
  selector: 'app-find-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    SpeciesPickerComponent,
    CheckboxComponent,
    FormFieldComponent,
    FormsModule,
    PhotoPickerComponent,
    NoteComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './find-form.component.html',
  styleUrl: './find-form.component.scss',
})
export class FindFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(SpeciesState);
  private readonly map = inject(MapState);

  readonly location = input.required<Location>();
  /** Ein vorhandener Fund, wenn das Formular ihn ändert statt anzulegen. */
  readonly start = input<Find | null>(null);
  /** Ein Fund, der schon steht, bekommt seine Fotos über die eigene Route. */
  readonly withPhotos = input(true);
  readonly titel = input.required<string>();
  readonly mainText = input.required<string>();
  readonly busy = input(false);

  readonly submitted = output<FindSubmission>();
  readonly cancelled = output();

  private readonly artSlug = signal<string | null>(null);
  private readonly dateChoice = signal<string | null>(null);
  private readonly countChoice = signal<string | null>(null);
  private readonly noteChoice = signal<string | null>(null);
  private readonly visibilityChoice = signal<Visibility | null>(null);
  private readonly trainingChoice = signal<boolean | null>(null);

  protected readonly fotos = signal<readonly File[]>([]);
  protected readonly speciesPickerOpen = signal(false);

  protected readonly segmente = computed(() => visibilitySegments(this.i18n));

  protected readonly datum = computed(() => this.dateChoice() ?? this.start()?.datum ?? isoDatum(new Date()));
  protected readonly anzahl = computed(() => {
    const selected = this.countChoice();
    if (selected !== null) return selected;
    const anzahl = this.start()?.anzahl;
    return anzahl === null || anzahl === undefined ? '' : String(anzahl);
  });
  protected readonly notiz = computed(() => this.noteChoice() ?? this.start()?.notiz ?? '');
  protected readonly sichtbarkeit = computed(
    () => this.visibilityChoice() ?? this.start()?.sichtbarkeit ?? 'privat',
  );
  // Die Freigabe ist eine bewusste Entscheidung, keine Vorgabe: aus.
  protected readonly fuerTraining = computed(
    () => this.trainingChoice() ?? this.start()?.fuerTraining ?? false,
  );

  /**
   * Die Vorgabe ist die Art der Karte. Der Katalog kennt sie unter ihrem
   * eigenen Slug; die Karte kennt nur den Slug ihrer Kacheln.
   */
  protected readonly selectedSpecies = computed<SpeciesBrief | null>(() => {
    const alle = this.arten.catalogue()?.arten ?? [];
    const selected = this.artSlug() ?? this.start()?.artSlug ?? null;
    if (selected !== null) return alle.find((art) => art.slug === selected) ?? null;
    const kartenSlug = this.map.art();
    return alle.find((art) => art.kartenSlug === kartenSlug) ?? null;
  });

  protected readonly speciesName = computed(() => this.selectedSpecies()?.name ?? '');

  protected readonly locationLine = computed(() => {
    const [lon, lat] = this.location();
    const text = locationText(lat, lon, this.i18n.locale());
    return this.i18n.translate('melden.ort', { lat: text.lat, lon: text.lon });
  });

  constructor() {
    this.arten.loadCatalogue();
  }

  protected selectSpecies(art: SpeciesBrief): void {
    this.artSlug.set(art.slug);
    this.speciesPickerOpen.set(false);
  }

  protected setDate(value: string): void {
    this.dateChoice.set(value);
  }

  protected setCount(value: string): void {
    this.countChoice.set(value);
  }

  protected setNote(value: string): void {
    this.noteChoice.set(value);
  }

  protected setVisibility(value: string): void {
    this.visibilityChoice.set(value === 'geteilt' ? 'geteilt' : 'privat');
  }

  protected setTraining(value: boolean): void {
    this.trainingChoice.set(value);
  }

  protected submit(): void {
    const input = this.validate();
    if (input !== null) this.submitted.emit({ input, fotos: this.fotos() });
  }

  /**
   * Prüft, was der Vertrag verlangt: eine Art aus dem Katalog, ein Datum, das
   * nicht in der Zukunft liegt, und eine Anzahl ab eins, falls eine dasteht.
   */
  private validate(): FindInput | null {
    const art = this.selectedSpecies();
    if (art === null) {
      this.toasts.error(this.i18n.translate('melden.artFehlt'));
      return null;
    }
    if (this.datum() > isoDatum(new Date())) {
      this.toasts.error(this.i18n.translate('melden.datumZukunft'));
      return null;
    }
    const raw = this.anzahl().trim();
    const anzahl = raw === '' ? null : Number(raw);
    if (anzahl !== null && (!Number.isInteger(anzahl) || anzahl < 1)) {
      this.toasts.error(this.i18n.translate('melden.anzahlUngueltig'));
      return null;
    }
    const [lon, lat] = this.location();
    const notiz = this.notiz().trim();
    return {
      artSlug: art.slug,
      lat,
      lon,
      datum: this.datum(),
      anzahl,
      notiz: notiz === '' ? null : notiz,
      sichtbarkeit: this.sichtbarkeit(),
      fuerTraining: this.fuerTraining(),
    };
  }
}
