import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import { BAUMARTEN, type ArtKurz, type Tag } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ChipGroupComponent,
  FormFieldComponent,
  NoteComponent,
  PageHeaderComponent,
  SeasonCurveComponent,
  SpeciesRowComponent,
  type Chip,
} from '../../ui';
import { ArtenZustand } from './arten.zustand';
import { STUFE_BADGE, TAG_TEXT } from './beschriftungen';

/** „alle“ zeigt den ganzen Katalog, jeder andere Chip ist ein Tag einer Art. */
type ChipWert = 'alle' | Tag;

/**
 * Die vier Chips der Mockups. Die Werte sind Enum-Werte des Backends, die
 * Beschriftungen stehen wörtlich in `docs/mockups/Arten.dc.html`.
 */
const CHIPS: readonly { wert: ChipWert; label: TranslationKey }[] = [
  { wert: 'alle', label: 'arten.chip.alle' },
  { wert: 'vorhersage', label: 'arten.chip.mitVorhersage' },
  { wert: 'roehrling', label: 'arten.chip.roehrlinge' },
  { wert: 'herbst', label: 'arten.chip.herbst' },
];

/** Ein Tag unter dem Namen einer Art. */
interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Eine Zeile der Liste, fertig für die Vorlage. */
interface Zeile {
  slug: string;
  name: string;
  latein: string;
  aktiv: boolean;
  marken: Marke[];
  kurve: readonly number[];
  beschriftung: string;
}

/**
 * Der Reiter Arten: Suche, Chips und die Liste mit kleiner Saisonkurve. Der
 * Katalog kommt einmal vom Server; Suche und Chips filtern im Speicher, weil
 * 85 Arten keine Anfrage je Tastendruck wert sind.
 */
@Component({
  selector: 'app-arten',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    CardComponent,
    ChipGroupComponent,
    FormFieldComponent,
    NoteComponent,
    PageHeaderComponent,
    SeasonCurveComponent,
    SpeciesRowComponent,
    TranslatePipe,
  ],
  templateUrl: './arten.component.html',
  styleUrl: './arten.component.scss',
})
export class ArtenComponent {
  private readonly zustand = inject(ArtenZustand);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly zeilenRefs = viewChildren(SpeciesRowComponent);

  /** Die kleine Kurve zeigt nur die Fläche; die Liste trägt kein laufendes Jahr. */
  protected readonly ohneLaufend: readonly number[] = [];

  protected readonly suche = signal('');
  protected readonly chip = signal<ChipWert>('alle');

  protected readonly chips = computed<Chip[]>(() =>
    CHIPS.map((chip) => ({ wert: chip.wert, label: this.i18n.translate(chip.label) })),
  );

  /** Die Begehungen je Woche gelten für alle Arten gleich und stehen am Kopf. */
  protected readonly begehungen = computed<readonly number[]>(
    () => this.zustand.liste()?.begehungenJeWocheAlleJahre ?? [],
  );

  protected readonly zeilen = computed<Zeile[]>(() => {
    const gesucht = this.suche().trim().toLocaleLowerCase();
    const chip = this.chip();
    const aktiv = this.zustand.aktiveArt();
    return (this.zustand.liste()?.arten ?? [])
      .filter((art) => chip === 'alle' || art.tags.includes(chip))
      .filter((art) => this.passt(art, gesucht))
      .map((art) => this.zeile(art, art.slug === aktiv));
  });

  constructor() {
    this.zustand.ladeListe();
  }

  protected waehleChip(wert: string): void {
    const chip = CHIPS.find((kandidat) => kandidat.wert === wert);
    if (chip) this.chip.set(chip.wert);
  }

  protected oeffne(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  /** Pfeil hoch und runter wandern durch die Liste; Enter öffnet die Zeile. */
  protected beiTaste(ereignis: KeyboardEvent, index: number): void {
    const schritt = ereignis.key === 'ArrowDown' ? 1 : ereignis.key === 'ArrowUp' ? -1 : 0;
    if (schritt === 0) return;
    const zeilen = this.zeilenRefs();
    const ziel = index + schritt;
    if (ziel < 0 || ziel >= zeilen.length) return;
    ereignis.preventDefault();
    zeilen[ziel].fokussiere();
  }

  private passt(art: ArtKurz, gesucht: string): boolean {
    if (gesucht === '') return true;
    return (
      art.name.toLocaleLowerCase().includes(gesucht) || art.lateinisch.toLocaleLowerCase().includes(gesucht)
    );
  }

  /**
   * Die Marken einer Zeile: erst die Stufe, dann der Schutz, zuletzt der Baum
   * oder die Jahreszeit. Die Zeile setzt bei einer aktiven Art selbst die Marke
   * „aktiv“ davor, darum bleibt hier eine Marke weniger Platz.
   */
  private zeile(art: ArtKurz, aktiv: boolean): Zeile {
    const marken: Marke[] = [
      { text: this.i18n.translate(TAG_TEXT[art.stufe]), variant: STUFE_BADGE[art.stufe] },
    ];
    if (art.geschuetzt) {
      marken.push({ text: this.i18n.translate('arten.geschuetzt'), variant: 'warning' });
    }
    // Der Baum sagt mehr über den Fundort als die Jahreszeit, die schon in der
    // Kurve steckt. Nur ohne Wirtsbaum tritt die Jahreszeit an seine Stelle.
    const baeume: readonly Tag[] = BAUMARTEN;
    const weiter =
      art.tags.find((tag) => baeume.includes(tag)) ??
      art.tags.find((tag) => tag !== art.stufe && tag !== art.gruppe);
    if (weiter) marken.push({ text: this.i18n.translate(TAG_TEXT[weiter]), variant: 'neutral' });
    return {
      slug: art.slug,
      name: art.name,
      latein: art.lateinisch,
      aktiv,
      marken: marken.slice(0, aktiv ? 2 : 3),
      kurve: art.saison.alleJahre,
      beschriftung: this.i18n.translate('art.kurve.beschriftung', {
        name: art.name,
        hoechstwert: Math.round(art.saison.hoechstwert),
      }),
    };
  }
}
