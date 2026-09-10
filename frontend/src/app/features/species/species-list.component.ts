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
import type { SpeciesBrief, Tag } from '../../core/api/models';
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
import { SpeciesState } from './species.state';
import {
  EDIBILITY_BADGE,
  EDIBILITY_DANGER,
  EDIBILITY_TEXT,
  GEFAEHRLICH,
  LEVEL_BADGE,
  LEVEL_RANK,
  TAG_TEXT,
} from './labels';

/** „alle“ zeigt den ganzen Katalog, jeder andere Chip ist ein Tag einer Art. */
type ChipValue = 'alle' | Tag;

/**
 * Die vier Chips der Mockups. Die Werte sind Enum-Werte des Backends, die
 * Beschriftungen stehen wörtlich in `docs/mockups/Arten.dc.html`.
 */
const CHIPS: readonly { value: ChipValue; label: TranslationKey }[] = [
  { value: 'alle', label: 'arten.chip.alle' },
  { value: 'vorhersage', label: 'arten.chip.mitVorhersage' },
  { value: 'roehrling', label: 'arten.chip.roehrlinge' },
  { value: 'herbst', label: 'arten.chip.herbst' },
  { value: 'verwechslung', label: 'arten.chip.verwechslung' },
];

/**
 * Der einzige Chip, der die nicht sammelbaren Profile zeigt. Die 224
 * Verwechslungsarten stehen sonst draußen: wer den Katalog durchblättert,
 * sucht etwas zum Sammeln.
 */
const CHIP_LOOKALIKE = 'verwechslung';

/** Ein Tag unter dem Namen einer Art. */
interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Eine Zeile der Liste, fertig für die Vorlage. */
interface Row {
  slug: string;
  name: string;
  latin: string;
  active: boolean;
  badges: Marke[];
  /** Ohne Saison zeichnet die Zeile keine Kurve, statt eine leere Achse zu zeigen. */
  hasCurve: boolean;
  curve: readonly number[];
  current: readonly number[];
  label: string;
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
  selector: 'app-species',
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
  templateUrl: './species-list.component.html',
  styleUrl: './species-list.component.scss',
})
export class SpeciesListComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly rowRefs = viewChildren(SpeciesRowComponent);

  protected readonly search = signal('');
  protected readonly chip = signal<ChipValue>('alle');

  protected readonly chips = computed<Chip[]>(() =>
    CHIPS.map((chip) => ({ value: chip.value, label: this.i18n.translate(chip.label) })),
  );

  /** Die Begehungen je Woche gelten für alle Arten gleich und stehen am Kopf. */
  protected readonly begehungen = computed<readonly number[]>(
    () => this.state.catalogue()?.begehungenJeWocheAlleJahre ?? [],
  );
  protected readonly visitsCurrentYear = computed<readonly number[]>(
    () => this.state.catalogue()?.begehungenJeWocheLaufendesJahr ?? [],
  );

  protected readonly rows = computed<Row[]>(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const chip = this.chip();
    const active = this.state.activeSpecies();
    // `filter` gibt schon eine eigene Liste zurück; `sort` rührt den Zustand nicht an.
    const filtered = this.grundmenge()
      .filter((art) => chip === 'alle' || chip === CHIP_LOOKALIKE || art.tags.includes(chip))
      .filter((art) => this.matches(art, query));
    // Unter „Giftig und Verwechslung“ führt die Gefahr, sonst die Stufe: wer
    // dort nachschlägt, sucht das Tödliche und nicht das Alphabet.
    const byDanger = chip === CHIP_LOOKALIKE;
    filtered.sort(
      (links, right) =>
        (byDanger
          ? EDIBILITY_DANGER[links.speisewert] - EDIBILITY_DANGER[right.speisewert]
          : LEVEL_RANK[links.stufe] - LEVEL_RANK[right.stufe]) || links.name.localeCompare(right.name, 'de'),
    );
    return filtered.map((art) => this.row(art, art.slug === active));
  });

  /**
   * Wie viele Arten die Liste gerade zeigt. Ohne diese Zeile wirkte ein Chip
   * wie tot: die Liste steht nach Stufe, die ersten Zeilen bleiben dieselben,
   * und dass aus 85 Arten 23 wurden, sieht man erst nach langem Scrollen.
   */
  /** Sammelbar oder nicht: der Chip entscheidet, aus welchem Topf gefiltert wird. */
  protected readonly grundmenge = computed<readonly SpeciesBrief[]>(() => {
    if (this.chip() === CHIP_LOOKALIKE) return this.state.verwechslungen()?.arten ?? [];
    // Wer einen Namen tippt, sucht über den ganzen Katalog: sonst fände er den
    // Giftpilz nicht, den er in der Hand hält.
    if (this.search().trim().length > 0) return this.state.alle()?.arten ?? [];
    return this.state.catalogue()?.arten ?? [];
  });

  protected readonly countText = computed(() => {
    const gesamt = this.grundmenge().length;
    const filtered = this.rows().length;
    return filtered === gesamt
      ? this.i18n.translate('arten.anzahlAlle', { gesamt })
      : this.i18n.translate('arten.anzahlGefiltert', { gefiltert: filtered, gesamt });
  });

  constructor() {
    this.state.loadCatalogue();
    // Beide Töpfe erst, wenn sie gebraucht werden.
    effect(() => {
      if (this.chip() === CHIP_LOOKALIKE) this.state.loadLookalikes();
      if (this.search().trim().length > 0) this.state.loadAll();
    });
  }

  protected selectChip(value: string): void {
    const chip = CHIPS.find((candidate) => candidate.value === value);
    if (chip) this.chip.set(chip.value);
  }

  protected open(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  /** Pfeil hoch und runter wandern durch die Liste; Enter öffnet die Zeile. */
  protected onKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    const rows = this.rowRefs();
    const target = index + step;
    if (target < 0 || target >= rows.length) return;
    event.preventDefault();
    rows[target].focus();
  }

  private matches(art: SpeciesBrief, query: string): boolean {
    if (query === '') return true;
    return art.name.toLocaleLowerCase().includes(query) || art.lateinisch.toLocaleLowerCase().includes(query);
  }

  /**
   * Die Marken einer Zeile, immer in derselben Reihenfolge: Stufe, Schutz,
   * Speisewert, Symbiosepartner, Jahreszeit. Jede steht für einen Filter, nach
   * dem man die Liste auch wirklich durchsuchen kann; vorher standen dort
   * beliebige Tags, die nichts zu tun hatten.
   *
   * Der Speisewert erscheint nur, wo er warnt. „Essbar“ an jeder zweiten Zeile
   * sagt nichts; „Tödlich giftig“ muss ins Auge springen.
   */
  private badges(art: SpeciesBrief): Marke[] {
    const badges: Marke[] = [
      { text: this.i18n.translate(TAG_TEXT[art.stufe]), variant: LEVEL_BADGE[art.stufe] },
    ];
    if (art.geschuetzt) {
      badges.push({ text: this.i18n.translate('arten.geschuetzt'), variant: 'warning' });
    }
    if (GEFAEHRLICH.includes(art.speisewert)) {
      badges.push({
        text: this.i18n.translate(EDIBILITY_TEXT[art.speisewert]),
        variant: EDIBILITY_BADGE[art.speisewert],
      });
    }
    // Der erste Baum ist der wichtigste: so stehen sie im Profil.
    const tree = art.baeume.at(0) ?? art.baeumeAusErfahrung?.baeume.at(0);
    if (tree) badges.push({ text: this.i18n.translate(TAG_TEXT[tree]), variant: 'neutral' });
    const season = art.jahreszeiten.at(0);
    if (season) {
      badges.push({ text: this.i18n.translate(TAG_TEXT[season]), variant: 'neutral' });
    }
    return badges;
  }

  private row(art: SpeciesBrief, active: boolean): Row {
    // Die Zeile setzt bei einer aktiven Art selbst die Marke „aktiv“ davor,
    // darum bleibt hier eine Marke weniger Platz.
    return {
      slug: art.slug,
      name: art.name,
      latin: art.lateinisch,
      active,
      badges: this.badges(art).slice(0, active ? 2 : 3),
      hasCurve: art.saison !== null,
      curve: art.saison?.alleJahre ?? [],
      current: art.saison?.laufendesJahr ?? [],
      label: this.i18n.translate('art.kurve.beschriftung', {
        name: art.name,
        hoechstwert: Math.round(art.saison?.hoechstwert ?? 0),
      }),
    };
  }
}
