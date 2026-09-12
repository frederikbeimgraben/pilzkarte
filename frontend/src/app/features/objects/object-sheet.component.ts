import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Find, Marker, Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { NoteComponent, SheetComponent } from '../../ui';
import { EntriesState } from '../entries/entries.state';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapState } from '../map/map.state';
import { FindSheetComponent } from './find-sheet.component';
import { MarkerSheetComponent } from './marker-sheet.component';
import { ZoneSheetComponent } from './zone-sheet.component';

/** Das Objekt steht auf 250 von 844 px, so wie im Artboard `Fund`. */
const DETENTS: readonly [number, number, number] = [0.7, 0.7, 0.7];

/**
 * Das Blatt über der Karte, das ein Objekt zeigt (Artboards `Fund` und
 * `Zone`).
 *
 * Welches Objekt offen ist, steht in der Adresse: `?objekt=fund:<id>`. So
 * führt ein Tipp in der Liste auf dieselbe Ansicht wie ein Tipp auf der Karte,
 * und ein Zurück im Browser schließt das Blatt.
 */
@Component({
  selector: 'app-object-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SheetHeightDirective,
    FindSheetComponent,
    MarkerSheetComponent,
    NoteComponent,
    SheetComponent,
    TranslatePipe,
    ZoneSheetComponent,
  ],
  templateUrl: './object-sheet.component.html',
  styleUrl: './object-sheet.component.scss',
})
export class ObjectSheetComponent {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly eintraege = inject(EntriesState);
  private readonly i18n = inject(I18nService);

  protected readonly map = inject(MapState);
  protected readonly detents = DETENTS;

  protected readonly find = computed<Find | null>(() => {
    const offen = this.map.object();
    if (offen?.art !== 'fund') return null;
    return this.eintraege.finds().find((candidate) => candidate.id === offen.id) ?? null;
  });

  protected readonly marker = computed<Marker | null>(() => {
    const offen = this.map.object();
    if (offen?.art !== 'marker') return null;
    return this.eintraege.marker().find((candidate) => candidate.id === offen.id) ?? null;
  });

  protected readonly zone = computed<Zone | null>(() => {
    const offen = this.map.object();
    if (offen?.art !== 'zone') return null;
    return this.eintraege.zones().find((candidate) => candidate.id === offen.id) ?? null;
  });

  /** Der Name des Blatts für Hilfsmittel: Fund, Marker oder Zone. */
  protected readonly sheetName = computed(() => {
    const offen = this.map.object();
    return offen === null ? '' : this.i18n.translate(`${offen.art}.blatt`);
  });

  /** Offen, aber nichts gefunden: der Eintrag ist fort oder gehört einem anderen Konto. */
  protected readonly missing = computed(
    () => this.map.object() !== null && !this.find() && !this.marker() && !this.zone(),
  );

  protected close(): void {
    this.map.object.set(null);
  }

  protected showOnMap(location: readonly [number, number]): void {
    this.adapter.flyTo(location);
    this.close();
  }
}
