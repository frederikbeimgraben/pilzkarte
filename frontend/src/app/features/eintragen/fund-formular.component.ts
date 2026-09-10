import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent, ToastService } from '@stupa-makers/ui-kit';
import type { ArtKurz, Fund, FundEingabe, Sichtbarkeit } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent, FormFieldComponent, NoteComponent, SegmentedComponent } from '../../ui';
import { ArtenZustand } from '../arten/arten.zustand';
import { KartenZustand } from '../karte/karten-zustand';
import { isoDatum, ortText } from '../eintraege/formate';
import { sichtbarkeitSegmente } from './sichtbarkeit';
import { ArtWahlComponent } from './art-wahl.component';
import { FotoWahlComponent } from './foto-wahl.component';
import type { Ort } from './eintragen.zustand';

/** Was das Formular abliefert: der Fund und seine noch nicht gesendeten Fotos. */
export interface FundAbgabe {
  eingabe: FundEingabe;
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
  selector: 'app-fund-formular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ArtWahlComponent,
    CheckboxComponent,
    FormFieldComponent,
    FormsModule,
    FotoWahlComponent,
    NoteComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './fund-formular.component.html',
  styleUrl: './fund-formular.component.scss',
})
export class FundFormularComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(ArtenZustand);
  private readonly karte = inject(KartenZustand);

  readonly ort = input.required<Ort>();
  /** Ein vorhandener Fund, wenn das Formular ihn ändert statt anzulegen. */
  readonly start = input<Fund | null>(null);
  /** Ein Fund, der schon steht, bekommt seine Fotos über die eigene Route. */
  readonly mitFotos = input(true);
  readonly titel = input.required<string>();
  readonly hauptText = input.required<string>();
  readonly beschaeftigt = input(false);

  readonly absenden = output<FundAbgabe>();
  readonly abbruch = output();

  private readonly artSlug = signal<string | null>(null);
  private readonly datumWahl = signal<string | null>(null);
  private readonly anzahlWahl = signal<string | null>(null);
  private readonly notizWahl = signal<string | null>(null);
  private readonly sichtbarkeitWahl = signal<Sichtbarkeit | null>(null);
  private readonly trainingWahl = signal<boolean | null>(null);

  protected readonly fotos = signal<readonly File[]>([]);
  protected readonly artWahlOffen = signal(false);

  protected readonly segmente = computed(() => sichtbarkeitSegmente(this.i18n));

  protected readonly datum = computed(() => this.datumWahl() ?? this.start()?.datum ?? isoDatum(new Date()));
  protected readonly anzahl = computed(() => {
    const gewaehlt = this.anzahlWahl();
    if (gewaehlt !== null) return gewaehlt;
    const anzahl = this.start()?.anzahl;
    return anzahl === null || anzahl === undefined ? '' : String(anzahl);
  });
  protected readonly notiz = computed(() => this.notizWahl() ?? this.start()?.notiz ?? '');
  protected readonly sichtbarkeit = computed(
    () => this.sichtbarkeitWahl() ?? this.start()?.sichtbarkeit ?? 'privat',
  );
  // Die Freigabe ist eine bewusste Entscheidung, keine Vorgabe: aus.
  protected readonly fuerTraining = computed(
    () => this.trainingWahl() ?? this.start()?.fuerTraining ?? false,
  );

  /**
   * Die Vorgabe ist die Art der Karte. Der Katalog kennt sie unter ihrem
   * eigenen Slug; die Karte kennt nur den Slug ihrer Kacheln.
   */
  protected readonly gewaehlteArt = computed<ArtKurz | null>(() => {
    const alle = this.arten.liste()?.arten ?? [];
    const gewaehlt = this.artSlug() ?? this.start()?.artSlug ?? null;
    if (gewaehlt !== null) return alle.find((art) => art.slug === gewaehlt) ?? null;
    const kartenSlug = this.karte.art();
    return alle.find((art) => art.kartenSlug === kartenSlug) ?? null;
  });

  protected readonly artName = computed(() => this.gewaehlteArt()?.name ?? '');

  protected readonly ortZeile = computed(() => {
    const [lon, lat] = this.ort();
    const text = ortText(lat, lon, this.i18n.locale());
    return this.i18n.translate('melden.ort', { lat: text.lat, lon: text.lon });
  });

  constructor() {
    this.arten.ladeListe();
  }

  protected waehleArt(art: ArtKurz): void {
    this.artSlug.set(art.slug);
    this.artWahlOffen.set(false);
  }

  protected setzeDatum(wert: string): void {
    this.datumWahl.set(wert);
  }

  protected setzeAnzahl(wert: string): void {
    this.anzahlWahl.set(wert);
  }

  protected setzeNotiz(wert: string): void {
    this.notizWahl.set(wert);
  }

  protected setzeSichtbarkeit(wert: string): void {
    this.sichtbarkeitWahl.set(wert === 'geteilt' ? 'geteilt' : 'privat');
  }

  protected setzeTraining(wert: boolean): void {
    this.trainingWahl.set(wert);
  }

  protected absende(): void {
    const eingabe = this.pruefe();
    if (eingabe !== null) this.absenden.emit({ eingabe, fotos: this.fotos() });
  }

  /**
   * Prüft, was der Vertrag verlangt: eine Art aus dem Katalog, ein Datum, das
   * nicht in der Zukunft liegt, und eine Anzahl ab eins, falls eine dasteht.
   */
  private pruefe(): FundEingabe | null {
    const art = this.gewaehlteArt();
    if (art === null) {
      this.toasts.error(this.i18n.translate('melden.artFehlt'));
      return null;
    }
    if (this.datum() > isoDatum(new Date())) {
      this.toasts.error(this.i18n.translate('melden.datumZukunft'));
      return null;
    }
    const roh = this.anzahl().trim();
    const anzahl = roh === '' ? null : Number(roh);
    if (anzahl !== null && (!Number.isInteger(anzahl) || anzahl < 1)) {
      this.toasts.error(this.i18n.translate('melden.anzahlUngueltig'));
      return null;
    }
    const [lon, lat] = this.ort();
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
