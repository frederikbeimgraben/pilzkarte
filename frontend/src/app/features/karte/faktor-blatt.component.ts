import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { anteilErfuellt, formatiereWert, type Ebene, type Histogramm } from '../../core/kacheln/ebenen';
import {
  ActionBarComponent,
  HistogramComponent,
  KeyValueRowComponent,
  NoteComponent,
  RangeSliderComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  type Griffe,
  type SegmentOption,
} from '../../ui';
import { bedingungText, spanne, type Bedingung, type Faktor } from './faktoren';

/** Wie fein der Griff läuft: fein genug zum Zielen, grob genug zum Ablesen. */
export function schrittWeite(ebene: Ebene): number {
  const breite = ebene.high - ebene.low;
  if (breite > 50) return 1;
  if (breite > 5) return 0.1;
  return 0.01;
}

/** Welche Griffe eine Bedingung braucht. */
const GRIFFE: Record<Bedingung, Griffe> = { unter: 'oben', ueber: 'unten', zwischen: 'beide' };

/**
 * Der Screen `Faktor`: die Verteilung der Quelle über Deutschland, die
 * Bedingung darüber, und was sie von der Fläche übrig lässt. Die Änderung
 * bleibt hier, bis sie übernommen wird.
 */
@Component({
  selector: 'app-faktor-blatt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    HistogramComponent,
    KeyValueRowComponent,
    NoteComponent,
    RangeSliderComponent,
    SegmentedComponent,
    SheetComponent,
    SheetHeadComponent,
    TranslatePipe,
  ],
  templateUrl: './faktor-blatt.component.html',
  styleUrl: './faktor-blatt.component.scss',
})
export class FaktorBlattComponent {
  private readonly i18n = inject(I18nService);

  readonly faktor = input.required<Faktor>();
  readonly ebene = input.required<Ebene>();
  readonly histogramm = input<Histogramm | null>(null);
  /** Der Zeitbezug für den Kopf: die Woche oder „zeitlich konstant“. */
  readonly zeitbezug = input<string>();

  readonly uebernehmen = output<Faktor>();
  readonly entfernen = output<Faktor>();
  readonly schliessen = output();

  /** Der Faktor in Arbeit. Ein neuer Faktor von außen setzt ihn zurück. */
  protected readonly entwurf = linkedSignal<Faktor, Faktor>({
    source: this.faktor,
    computation: (faktor) => faktor,
  });

  protected readonly bedingungen = computed<SegmentOption[]>(() =>
    (['unter', 'ueber', 'zwischen'] as const).map((wert) => ({
      wert,
      label: this.i18n.translate(`faktor.${wert}`),
    })),
  );

  protected readonly griffe = computed<Griffe>(() => GRIFFE[this.entwurf().bedingung]);
  protected readonly schritt = computed(() => schrittWeite(this.ebene()));
  protected readonly werte = computed(() => spanne(this.entwurf(), this.ebene()));

  protected readonly vonAnteil = computed(() => this.anteilAufSkala(this.werte().von));
  protected readonly bisAnteil = computed(() => this.anteilAufSkala(this.werte().bis));

  protected readonly bedingung = computed(() =>
    bedingungText(this.entwurf(), this.ebene(), this.i18n.locale(), this.i18n.translate('faktor.bis')),
  );

  protected readonly skalaVon = computed(() =>
    formatiereWert(this.ebene().low, this.ebene(), this.i18n.locale()),
  );

  protected readonly skalaBis = computed(() =>
    formatiereWert(this.ebene().high, this.ebene(), this.i18n.locale()),
  );

  protected readonly verteilungText = computed(() =>
    this.i18n.translate('faktor.verteilung', { ebene: this.ebene().label }),
  );

  /** Was die Bedingung von der Fläche Deutschlands übrig lässt. */
  protected readonly anteilText = computed(() => {
    const verteilung = this.histogramm();
    if (!verteilung) return this.i18n.translate('faktor.ohneVerteilung');
    const werte = this.werte();
    const anteil = anteilErfuellt(verteilung, werte.von, werte.bis);
    return this.i18n.translate('faktor.anteil', { anteil: Math.round(anteil * 100) });
  });

  protected setzeBedingung(wert: string): void {
    const bedingung = (['unter', 'ueber', 'zwischen'] as const).find((eintrag) => eintrag === wert);
    if (!bedingung) return;
    // Die Spanne bleibt, wo sie war: der Wechsel der Form soll den Faktor
    // nicht auf einen anderen Ausschnitt der Skala werfen.
    const werte = this.werte();
    this.entwurf.set({ ...this.entwurf(), bedingung, von: werte.von, bis: werte.bis });
  }

  protected setzeVon(wert: number): void {
    this.entwurf.set({ ...this.entwurf(), von: Math.min(wert, this.werte().bis) });
  }

  protected setzeBis(wert: number): void {
    this.entwurf.set({ ...this.entwurf(), bis: Math.max(wert, this.werte().von) });
  }

  private anteilAufSkala(wert: number): number {
    const breite = this.ebene().high - this.ebene().low;
    return breite === 0 ? 0 : Math.min(Math.max((wert - this.ebene().low) / breite, 0), 1);
  }
}
