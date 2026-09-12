import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { BadgeComponent, CardComponent, DialogComponent, ToastService } from '@stupa-makers/ui-kit';
import type { Find } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ManifestService } from '../../core/tiles/manifest.service';
import { NOW } from '../../core/tiles/now';
import { currentWeek, findWeek, type ManifestWeek } from '../../core/tiles/manifest';
import { valueAtPoint } from '../../core/tiles/value-at-point';
import { ActionBarComponent, MetricRowComponent, NoteComponent } from '../../ui';
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { longDate } from '../../core/i18n/dates';
import { FindFormComponent, type FindSubmission } from '../add-entry/find-form.component';
import { MapState } from '../map/map.state';
import { PhotoGalleryComponent } from './photo-gallery.component';

/**
 * Das Objekt-Blatt eines Fundes (Artboard `Fund`).
 *
 * Die Kennzahl darunter nennt Art, Woche und Ort: sie kommt aus derselben
 * Wertkachel, die die Karte färbt, an genau dem Punkt des Fundes.
 */
@Component({
  selector: 'app-find-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    CardComponent,
    DialogComponent,
    PhotoGalleryComponent,
    FindFormComponent,
    MetricRowComponent,
    NoteComponent,
    TranslatePipe,
  ],
  templateUrl: './find-sheet.component.html',
  styleUrl: './find-sheet.component.scss',
})
export class FindSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(SpeciesState);
  private readonly eintraege = inject(EntriesState);
  private readonly map = inject(MapState);
  private readonly manifests = inject(ManifestService);
  private readonly now = inject(NOW);

  readonly find = input.required<Find>();

  /** „Auf der Karte anzeigen“: der Ort, zu dem die Karte fahren soll. */
  readonly showOnMap = output<readonly [number, number]>();
  readonly closed = output();

  protected readonly editing = signal(false);
  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  private readonly woche = signal<ManifestWeek | null>(null);
  private readonly value = signal<number | null>(null);

  protected readonly art = computed(() => {
    const slug = this.find().artSlug;
    return (this.arten.catalogue()?.arten ?? []).find((candidate) => candidate.slug === slug) ?? null;
  });

  protected readonly speciesName = computed(() => this.art()?.name ?? this.find().artSlug);
  protected readonly geteilt = computed(() => this.find().sichtbarkeit === 'geteilt');
  protected readonly location = computed<readonly [number, number]>(() => [this.find().lon, this.find().lat]);

  protected readonly subline = computed(() => {
    const find = this.find();
    const datum = longDate(find.datum, this.i18n.locale());
    const melder = this.eintraege.melder() ?? '';
    if (find.anzahl === null) return this.i18n.translate('fund.unterOhneAnzahl', { datum, melder });
    return this.i18n.translate('fund.unter', {
      datum,
      anzahl: this.i18n.translate('fund.stueck', { anzahl: find.anzahl }),
      melder,
    });
  });

  /** „Steinpilz, KW 40 · 2025, je Begehung“ — jede Zahl nennt ihren Bezug. */
  protected readonly valueScope = computed(() => {
    const woche = this.woche();
    if (woche === null) return '';
    return this.i18n.translate('fund.vorhersageUnter', {
      art: this.speciesName(),
      woche: woche.woche,
      jahr: woche.jahr,
    });
  });

  protected readonly valueText = computed(() => {
    const value = this.value();
    return value === null ? null : this.i18n.translate('karte.prozent', { wert: Math.round(value * 100) });
  });

  constructor() {
    this.arten.loadCatalogue();
    effect(() => {
      void this.fetchValue(this.find(), this.map.woche());
    });
  }

  protected async save(submission: FindSubmission): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.eintraege.updateFind(this.find().id, submission.input)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.editing.set(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteFind(this.find().id)) {
      this.toasts.success(this.i18n.translate('fund.geloescht'));
      this.closed.emit();
    }
  }

  /**
   * Liest den Wert der aktiven Woche am Ort des Fundes. Ohne Vorhersagekarte
   * für diese Art bleibt die Zeile weg, statt eine Null zu behaupten.
   */
  private async fetchValue(find: Find, weekKey: string | null): Promise<void> {
    this.value.set(null);
    this.woche.set(null);
    const kartenSlug = this.art()?.kartenSlug ?? null;
    if (kartenSlug === null) return;
    try {
      const manifest = await this.manifests.get(kartenSlug);
      const woche =
        (weekKey !== null ? findWeek(manifest, weekKey) : null) ?? currentWeek(manifest, this.now());
      if (woche === null) return;
      this.woche.set(woche);
      this.value.set(await valueAtPoint(manifest, woche.tilePath, find.lon, find.lat));
    } catch {
      // Ohne Manifest gibt es keine Zahl mit Bezug, also auch keine Zeile.
    }
  }
}
