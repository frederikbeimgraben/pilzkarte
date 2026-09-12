import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CardComponent, DialogComponent, ToastService } from '@stupa-makers/ui-kit';
import { firstValueFrom } from 'rxjs';
import { EntriesApi } from '../../core/api/entries.api';
import type { Zone, ZoneValue } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { currentWeek, findWeek } from '../../core/tiles/manifest';
import { ManifestService } from '../../core/tiles/manifest.service';
import { NOW } from '../../core/tiles/now';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { ActionBarComponent, KeyValueTableComponent, MetricRowComponent, NoteComponent } from '../../ui';
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { colorHex } from '../entries/colors';
import { hectaresText } from '../entries/formats';
import { asPolygon } from '../add-entry/area';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';
import { visibilityText } from '../add-entry/visibility';
import { ZONE_DRAWER, type DrawSession } from '../add-entry/zone-drawer';
import { MapState } from '../map/map.state';
import type { Location } from '../add-entry/add-entry.state';

/**
 * Das Objekt-Blatt einer Zone (Artboard `Zone`).
 *
 * Die zwei Kennzahlen kommen vom Dienst: das Flächenmittel der Vorhersage für
 * genau die Art und Woche der Karte, und die eigenen Funde in der Fläche über
 * alle Arten und Jahre. „Eckpunkte bearbeiten“ gibt die Ecken an Terra Draw,
 * wo sie sich mit dem Finger ziehen lassen.
 */
@Component({
  selector: 'app-zone-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CardComponent,
    DialogComponent,
    KeyValueTableComponent,
    MetricRowComponent,
    NoteComponent,
    ObjectFormComponent,
    TranslatePipe,
  ],
  templateUrl: './zone-sheet.component.html',
  styleUrl: './zone-sheet.component.scss',
})
export class ZoneSheetComponent implements OnDestroy {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly api = inject(EntriesApi);
  private readonly arten = inject(SpeciesState);
  private readonly eintraege = inject(EntriesState);
  private readonly i18n = inject(I18nService);
  private readonly map = inject(MapState);
  private readonly manifests = inject(ManifestService);
  private readonly now = inject(NOW);
  private readonly toasts = inject(ToastService);
  private readonly draw = inject(ZONE_DRAWER);

  private readonly form = viewChild(ObjectFormComponent);

  readonly zone = input.required<Zone>();

  readonly showOnMap = output<readonly [number, number]>();
  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  protected readonly editingCorners = signal(false);
  private readonly value = signal<ZoneValue | null>(null);
  private readonly newCorners = signal<readonly Location[] | null>(null);
  private session: DrawSession | null = null;

  protected readonly subline = computed(() =>
    this.i18n.translate('zone.unter', {
      flaeche: hectaresText(this.zone().flaecheHa, this.i18n.locale()),
      sichtbarkeit: visibilityText(this.i18n, this.zone().sichtbarkeit),
    }),
  );

  protected readonly start = computed<ObjectValues>(() => {
    const zone = this.zone();
    return { name: zone.name, farbe: zone.farbe, notiz: zone.notiz, sichtbarkeit: zone.sichtbarkeit };
  });

  protected readonly forecastRow = computed(() => {
    const value = this.value();
    if (value === null) return null;
    return {
      label: this.i18n.translate('zone.vorhersage', {
        art: this.speciesName(value.art),
        woche: value.woche.woche,
      }),
      value: this.i18n.translate('karte.prozent', { wert: Math.round(value.flaechenmittel) }),
      finds: String(value.eigeneFunde),
    };
  });

  /** Der Mittelpunkt der Fläche, damit „Auf der Karte“ die Zone zeigt. */
  protected readonly center = computed<readonly [number, number]>(() => {
    const ring = this.zone().polygon.coordinates[0];
    const sum = ring.reduce((links, point) => [links[0] + point[0], links[1] + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  });

  constructor() {
    this.arten.loadCatalogue();
    effect(() => {
      void this.fetchValue(this.zone().id, this.map.art(), this.map.woche());
    });
  }

  ngOnDestroy(): void {
    this.stopSession();
  }

  protected async save(): Promise<void> {
    const values = this.form()?.values();
    if (!values) return;
    this.busy.set(true);
    try {
      if (await this.eintraege.updateZone(this.zone().id, values)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Gibt die Ecken an Terra Draw. Sie lassen sich dann mit dem Finger ziehen. */
  protected async editCorners(): Promise<void> {
    const map = this.adapter.rawMap();
    if (map === null) return;
    this.editingCorners.set(true);
    this.session = await this.draw(map, colorHex(this.zone().farbe));
    const ring = this.zone()
      .polygon.coordinates[0].slice(0, -1)
      .map((point) => point as Location);
    this.session.showRing(ring);
    this.session.edit((next) => {
      this.newCorners.set(next);
    });
  }

  protected async applyCorners(): Promise<void> {
    const corners = this.newCorners();
    const polygon = corners === null ? null : asPolygon(corners);
    this.stopSession();
    if (polygon === null) return;
    if (await this.eintraege.updateZone(this.zone().id, { polygon })) {
      this.toasts.success(this.i18n.translate('objekt.gespeichert'));
    }
  }

  protected cancelCorners(): void {
    this.stopSession();
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteZone(this.zone().id)) {
      this.toasts.success(this.i18n.translate('objekt.geloescht'));
      this.closed.emit();
    }
  }

  private speciesName(slug: string): string {
    return (this.arten.catalogue()?.arten ?? []).find((art) => art.slug === slug)?.name ?? slug;
  }

  /**
   * Fragt den Dienst nach dem Flächenmittel. Der Endpunkt kennt Arten des
   * Katalogs; die Karte kennt nur den Slug ihrer Kacheln, darum der Umweg.
   */
  private async fetchValue(id: string, kartenSlug: string, weekKey: string | null): Promise<void> {
    this.value.set(null);
    const art = (this.arten.catalogue()?.arten ?? []).find(
      (candidate) => candidate.kartenSlug === kartenSlug,
    );
    if (!art) return;
    try {
      const manifest = await this.manifests.get(kartenSlug);
      const woche =
        (weekKey !== null ? findWeek(manifest, weekKey) : null) ?? currentWeek(manifest, this.now());
      if (woche === null) return;
      this.value.set(await firstValueFrom(this.api.zoneValue(id, art.slug, woche.jahr, woche.woche)));
    } catch {
      // Ohne Karte für diese Art und Woche bleibt die Zeile weg.
    }
  }

  private stopSession(): void {
    this.session?.stop();
    this.session = null;
    this.newCorners.set(null);
    this.editingCorners.set(false);
  }
}
