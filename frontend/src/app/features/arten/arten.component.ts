import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import { BAUMARTEN, type ArtKurz, type Tag } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ChipGroupComponent,
  EmptyStateComponent,
  FormFieldComponent,
  NoteComponent,
  PageHeaderComponent,
  SeasonCurveComponent,
  SpeciesRowComponent,
  type Chip,
} from '../../ui';
import { ArtenZustand } from './arten.zustand';
import {
  ESSBARKEIT_BADGE,
  ESSBARKEIT_GEFAHR,
  ESSBARKEIT_TEXT,
  STUFE_BADGE,
  STUFE_RANG,
  TAG_TEXT,
} from './beschriftungen';

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
  { wert: 'verwechslung', label: 'arten.chip.verwechslung' },
];

/**
 * Der einzige Chip, der die nicht sammelbaren Profile zeigt. Die 224
 * Verwechslungsarten stehen sonst draußen: wer den Katalog durchblättert,
 * sucht etwas zum Sammeln.
 */
const CHIP_VERWECHSLUNG = 'verwechslung';

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
  /** Ohne Saison zeichnet die Zeile keine Kurve, statt eine leere Achse zu zeigen. */
  hatKurve: boolean;
  kurve: readonly number[];
  laufend: readonly number[];
  beschriftung: string;
}

/**
 * Der Reiter Arten: Suche, Chips und die Liste mit kleiner Saisonkurve. Der
 * Katalog kommt einmal vom Server; Suche und Chips filtern im Speicher, weil
 * 85 Arten keine Anfrage je Tastendruck wert sind.
 *
 * Die Liste steht nach Stufe, innerhalb nach Namen. So stehen unter „alle“ die
 * 23 Arten mit Vorhersage oben, statt zwischen 62 Profilen verstreut. Die
 * aktive Art bleibt an ihrem Platz, sonst spränge die Liste beim Auswählen.
 */
@Component({
  selector: 'app-arten',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    CardComponent,
    ChipGroupComponent,
    EmptyStateComponent,
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

  protected readonly suche = signal('');
  protected readonly chip = signal<ChipWert>('alle');

  protected readonly chips = computed<Chip[]>(() =>
    CHIPS.map((chip) => ({ wert: chip.wert, label: this.i18n.translate(chip.label) })),
  );

  /** Die Begehungen je Woche gelten für alle Arten gleich und stehen am Kopf. */
  protected readonly begehungen = computed<readonly number[]>(
    () => this.zustand.liste()?.begehungenJeWocheAlleJahre ?? [],
  );
  protected readonly begehungenLaufend = computed<readonly number[]>(
    () => this.zustand.liste()?.begehungenJeWocheLaufendesJahr ?? [],
  );

  protected readonly zeilen = computed<Zeile[]>(() => {
    const gesucht = this.suche().trim().toLocaleLowerCase();
    const chip = this.chip();
    const aktiv = this.zustand.aktiveArt();
    // `filter` gibt schon eine eigene Liste zurück; `sort` rührt den Zustand nicht an.
    const gefiltert = this.grundmenge()
      .filter((art) => chip === 'alle' || chip === CHIP_VERWECHSLUNG || art.tags.includes(chip))
      .filter((art) => this.passt(art, gesucht));
    // Unter „Giftig und Verwechslung“ führt die Gefahr, sonst die Stufe: wer
    // dort nachschlägt, sucht das Tödliche und nicht das Alphabet.
    const nachGefahr = chip === CHIP_VERWECHSLUNG;
    gefiltert.sort(
      (links, rechts) =>
        (nachGefahr
          ? ESSBARKEIT_GEFAHR[links.speisewert] - ESSBARKEIT_GEFAHR[rechts.speisewert]
          : STUFE_RANG[links.stufe] - STUFE_RANG[rechts.stufe]) ||
        links.name.localeCompare(rechts.name, 'de'),
    );
    return gefiltert.map((art) => this.zeile(art, art.slug === aktiv));
  });

  /**
   * Wie viele Arten die Liste gerade zeigt. Ohne diese Zeile wirkte ein Chip
   * wie tot: die Liste steht nach Stufe, die ersten Zeilen bleiben dieselben,
   * und dass aus 85 Arten 23 wurden, sieht man erst nach langem Scrollen.
   */
  /** Sammelbar oder nicht: der Chip entscheidet, aus welchem Topf gefiltert wird. */
  protected readonly grundmenge = computed<readonly ArtKurz[]>(() => {
    if (this.chip() === CHIP_VERWECHSLUNG) return this.zustand.verwechslungen()?.arten ?? [];
    // Wer einen Namen tippt, sucht über den ganzen Katalog: sonst fände er den
    // Giftpilz nicht, den er in der Hand hält.
    if (this.suche().trim().length > 0) return this.zustand.alle()?.arten ?? [];
    return this.zustand.liste()?.arten ?? [];
  });

  protected readonly anzahlText = computed(() => {
    const gesamt = this.grundmenge().length;
    const gefiltert = this.zeilen().length;
    return gefiltert === gesamt
      ? this.i18n.translate('arten.anzahlAlle', { gesamt })
      : this.i18n.translate('arten.anzahlGefiltert', { gefiltert, gesamt });
  });

  constructor() {
    this.zustand.ladeListe();
    // Beide Töpfe erst, wenn sie gebraucht werden.
    effect(() => {
      if (this.chip() === CHIP_VERWECHSLUNG) this.zustand.ladeVerwechslungen();
      if (this.suche().trim().length > 0) this.zustand.ladeAlle();
    });
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
    // Wer die Liste nach einem Giftpilz durchsucht, muss ihn sofort erkennen.
    if (!art.sammelbar) {
      marken.push({
        text: this.i18n.translate(ESSBARKEIT_TEXT[art.speisewert]),
        variant: ESSBARKEIT_BADGE[art.speisewert],
      });
    }
    // Genug Funde für ein Modell, aber noch keine Karte: das ist eine eigene
    // Nachricht und nicht dasselbe wie die Stufe.
    if (art.vorhersageGeplant && !art.kartenSlug) {
      marken.push({ text: this.i18n.translate('arten.vorhersageGeplant'), variant: 'info' });
    }
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
      hatKurve: art.saison !== null,
      kurve: art.saison?.alleJahre ?? [],
      laufend: art.saison?.laufendesJahr ?? [],
      beschriftung: this.i18n.translate('art.kurve.beschriftung', {
        name: art.name,
        hoechstwert: Math.round(art.saison?.hoechstwert ?? 0),
      }),
    };
  }
}
