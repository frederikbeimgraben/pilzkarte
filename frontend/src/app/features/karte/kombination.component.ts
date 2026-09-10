import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Ebene } from '../../core/kacheln/ebenen';
import type { KombiRegel } from '../../map/wert-farben';
import {
  ActionBarComponent,
  FactorRowComponent,
  NoteComponent,
  SegmentedComponent,
  type SegmentOption,
} from '../../ui';
import { bedingungText, type Faktor } from './faktoren';

/** Ein Faktor, wie ihn die Zeile braucht: mit aufgelöster Quelle. */
interface Zeile {
  faktor: Faktor;
  name: string;
  unter: string;
  bedingung: string;
}

/**
 * Die Darstellung „Kombination“: eine Regel, eine Liste von Faktoren und die
 * Aktionen darunter. Sie hängt an keiner Art.
 */
@Component({
  selector: 'app-kombination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, FactorRowComponent, NoteComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './kombination.component.html',
  styleUrl: './kombination.component.scss',
})
export class KombinationComponent {
  private readonly i18n = inject(I18nService);

  readonly faktoren = input.required<readonly Faktor[]>();
  /** Die Quellen der Faktoren, nach Kennung. Was fehlt, wird nicht gezeigt. */
  readonly quellen = input.required<ReadonlyMap<string, Ebene>>();
  readonly regel = input.required<KombiRegel>();
  /** Die Woche, auf die sich die Wochenfaktoren beziehen. */
  readonly wochenText = input<string>();

  readonly regelChange = output<KombiRegel>();
  readonly aktivChange = output<{ faktor: Faktor; aktiv: boolean }>();
  readonly faktorOeffnen = output<Faktor>();
  readonly hinzufuegen = output();

  protected readonly regeln = computed<SegmentOption[]>(() =>
    (['schnitt', 'abgestuft'] as const).map((wert) => ({
      wert,
      label: this.i18n.translate(`kombination.${wert}`),
    })),
  );

  protected readonly zeilen = computed<Zeile[]>(() => {
    const quellen = this.quellen();
    const locale = this.i18n.locale();
    const bis = this.i18n.translate('faktor.bis');
    return this.faktoren().flatMap((faktor) => {
      const ebene = quellen.get(faktor.quelle);
      if (!ebene) return [];
      return [
        {
          faktor,
          name: ebene.label,
          unter: ebene.fest
            ? this.i18n.translate('faktor.konstant')
            : (this.wochenText() ?? this.i18n.translate('faktor.konstant')),
          bedingung: bedingungText(faktor, ebene, locale, bis),
        },
      ];
    });
  });

  protected readonly hinweis = computed(() =>
    this.i18n.translate(
      this.regel() === 'schnitt' ? 'kombination.hinweisSchnitt' : 'kombination.hinweisAbgestuft',
      { woche: this.wochenText() ?? '' },
    ),
  );

  protected setzeRegel(wert: string): void {
    if (wert === 'schnitt' || wert === 'abgestuft') this.regelChange.emit(wert);
  }
}
