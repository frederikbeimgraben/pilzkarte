import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, ButtonComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import type { Find, SharedFind, Marker, Visibility, Zone } from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import type { QueueKind, QueueEntry } from '../../core/offline/queue';
import {
  ChipGroupComponent,
  EmptyStateComponent,
  ListRowComponent,
  NoteComponent,
  PageHeaderComponent,
  SvgIconComponent,
  type Chip,
} from '../../ui';
import { SpeciesState } from '../species/species.state';
import { AddEntryState } from '../add-entry/add-entry.state';
import { visibilityText } from '../add-entry/visibility';
import { writeObject, type ObjectKind } from '../map/map.state';
import { EntriesState } from './entries.state';
import { colorHex } from './colors';
import { hectaresText, isoDatum, shortDate } from './formats';

/** Die vier Chips über der Liste, wie im Artboard `Funde`. */
type ChipValue = 'funde' | 'marker' | 'zonen' | 'geteilt';

const CHIPS: readonly { value: ChipValue; label: TranslationKey; waiter: QueueKind }[] = [
  { value: 'funde', label: 'eintraege.chip.funde', waiter: 'fund' },
  { value: 'marker', label: 'eintraege.chip.marker', waiter: 'marker' },
  { value: 'zonen', label: 'eintraege.chip.zonen', waiter: 'zone' },
  { value: 'geteilt', label: 'eintraege.chip.geteilt', waiter: 'fund' },
];

/** Ein Kennzeichen rechts an der Zeile. */
interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Eine Zeile der Liste, fertig für die Vorlage. */
interface Row {
  schluessel: string;
  farbe: string;
  titel: string;
  subline: string;
  notiz: string;
  badge: Marke | null;
  /** `null` bei einem Eintrag, der noch auf die Übertragung wartet. */
  object: { art: ObjectKind; id: string } | null;
}

/**
 * Die Farben der Punkte vor einer Zeile, aus `docs/mockups/bauen.py`: ein
 * eigener Fund trägt `accent4`, ein fremder geteilter das gedämpfte `info`.
 */
const OWN_FIND = '#c8a25a';
const FOREIGN_FIND = '#185468';

/**
 * Der Reiter Einträge (Artboard `Funde`): Chips, Liste, und ein Tipp öffnet
 * das Objekt über der Karte.
 *
 * Was noch auf die Übertragung wartet, steht mit seinem Kennzeichen oben in
 * der Liste. Öffnen lässt es sich nicht: es hat noch keine Kennung vom Dienst.
 */
@Component({
  selector: 'app-entries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ChipGroupComponent,
    EmptyStateComponent,
    ListRowComponent,
    NoteComponent,
    PageHeaderComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './entries.component.html',
  styleUrl: './entries.component.scss',
})
export class EntriesComponent {
  private readonly arten = inject(SpeciesState);
  private readonly auth = inject(AuthService);
  private readonly addEntryState = inject(AddEntryState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(EntriesState);

  protected readonly chip = signal<ChipValue>('funde');
  protected readonly signedIn = this.state.signedIn;

  protected readonly chips = computed<Chip[]>(() =>
    CHIPS.map((chip) => ({ value: chip.value, label: this.i18n.translate(chip.label) })),
  );

  protected readonly rows = computed<Row[]>(() => {
    const chip = this.chip();
    if (chip === 'geteilt') return this.state.shared().map((find) => this.sharedRow(find));
    const waiter = CHIPS.find((candidate) => candidate.value === chip)?.waiter ?? 'fund';
    const pending = this.state
      .pendingEntries()
      .filter((entry) => entry.art === waiter)
      .map((entry) => this.pendingRow(entry));
    if (chip === 'marker') {
      return [...pending, ...this.state.marker().map((entry) => this.markerRow(entry))];
    }
    if (chip === 'zonen') return [...pending, ...this.state.zones().map((zone) => this.zoneRow(zone))];
    return [...pending, ...this.state.finds().map((find) => this.findRow(find))];
  });

  protected readonly emptyText = computed<TranslationKey>(() => {
    if (this.needsSignIn()) return 'eintraege.anmelden';
    return this.chip() === 'geteilt' ? 'eintraege.leerGeteilt' : 'eintraege.leer';
  });

  /** Geteilte Funde stehen jedem offen; die eigenen liegen hinter dem Konto. */
  protected readonly needsSignIn = computed(() => !this.signedIn() && this.chip() !== 'geteilt');

  protected signIn(): void {
    void this.auth.requestSignIn();
  }

  constructor() {
    this.arten.loadCatalogue();
    void this.state.load();
    void this.state.loadShared();
  }

  protected selectChip(value: string): void {
    const chip = CHIPS.find((candidate) => candidate.value === value);
    if (chip) this.chip.set(chip.value);
  }

  /** Der Plus-Knopf der Kopfleiste führt auf die Karte und öffnet das Menü. */
  protected async addEntry(): Promise<void> {
    await this.router.navigate(['/karte']);
    this.addEntryState.open();
  }

  protected open(row: Row): void {
    if (row.object === null) return;
    void this.router.navigate(['/karte'], { queryParams: { objekt: writeObject(row.object) } });
  }

  private speciesName(slug: string): string {
    return (this.arten.catalogue()?.arten ?? []).find((art) => art.slug === slug)?.name ?? slug;
  }

  private datum(iso: string): string {
    return shortDate(iso, this.i18n.locale(), isoDatum(new Date()), this.i18n.translate('eintraege.heute'));
  }

  /** „6. Sept. · 3 Stück · Frederik“, so wie im Artboard `Funde`. */
  private findSubline(datum: string, anzahl: number | null, melder: string): string {
    if (anzahl === null) return this.i18n.translate('fund.unterOhneAnzahl', { datum, melder });
    return this.i18n.translate('fund.unter', {
      datum,
      anzahl: this.i18n.translate('fund.stueck', { anzahl }),
      melder,
    });
  }

  private sharedBadge(sichtbarkeit: Visibility): Marke | null {
    return sichtbarkeit === 'geteilt'
      ? { text: this.i18n.translate('eintraege.badge.geteilt'), variant: 'success' }
      : null;
  }

  private findRow(find: Find): Row {
    return {
      schluessel: `fund-${find.id}`,
      farbe: OWN_FIND,
      titel: this.speciesName(find.artSlug),
      subline: this.findSubline(this.datum(find.datum), find.anzahl, this.state.melder() ?? ''),
      notiz: find.notiz ?? '',
      badge: this.sharedBadge(find.sichtbarkeit),
      object: { art: 'fund', id: find.id },
    };
  }

  private sharedRow(find: SharedFind): Row {
    return {
      schluessel: `geteilt-${find.id}`,
      farbe: find.eigen ? OWN_FIND : FOREIGN_FIND,
      titel: this.speciesName(find.artSlug),
      subline: this.findSubline(this.datum(find.datum), find.anzahl, find.melder ?? ''),
      notiz: find.notiz ?? '',
      badge: { text: this.i18n.translate('eintraege.badge.geteilt'), variant: 'success' },
      // Ein fremder Fund hat kein Blatt: der Dienst gibt ihn nur als Punkt her.
      object: find.eigen ? { art: 'fund', id: find.id } : null,
    };
  }

  private markerRow(marker: Marker): Row {
    return {
      schluessel: `marker-${marker.id}`,
      farbe: colorHex(marker.farbe),
      titel: marker.name,
      subline: this.i18n.translate('marker.unter', {
        sichtbarkeit: visibilityText(this.i18n, marker.sichtbarkeit),
      }),
      notiz: marker.notiz ?? '',
      badge: this.sharedBadge(marker.sichtbarkeit),
      object: { art: 'marker', id: marker.id },
    };
  }

  private zoneRow(zone: Zone): Row {
    return {
      schluessel: `zone-${zone.id}`,
      farbe: colorHex(zone.farbe),
      titel: zone.name,
      subline: this.i18n.translate('zone.unter', {
        flaeche: hectaresText(zone.flaecheHa, this.i18n.locale()),
        sichtbarkeit: visibilityText(this.i18n, zone.sichtbarkeit),
      }),
      notiz: zone.notiz ?? '',
      badge: this.sharedBadge(zone.sichtbarkeit),
      object: { art: 'zone', id: zone.id },
    };
  }

  private pendingRow(entry: QueueEntry): Row {
    const body = entry.body;
    const titel = 'artSlug' in body ? this.speciesName(body.artSlug) : body.name;
    const subline =
      'datum' in body
        ? this.findSubline(this.datum(body.datum), body.anzahl ?? null, this.state.melder() ?? '')
        : '';
    return {
      schluessel: `warte-${entry.id}`,
      farbe: 'farbe' in body ? colorHex(body.farbe) : OWN_FIND,
      titel,
      subline,
      notiz: body.notiz ?? '',
      badge: { text: this.i18n.translate('eintraege.badge.ausstehend'), variant: 'warning' },
      object: null,
    };
  }
}
