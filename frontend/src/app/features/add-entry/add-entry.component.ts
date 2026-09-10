import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import type { Color } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MAP_ADAPTER } from '../../map/map.tokens';
import {
  ActionBarComponent,
  ActionRowComponent,
  ActionSheetComponent,
  CrosshairComponent,
  NoteComponent,
  SheetComponent,
  type DetentSize,
} from '../../ui';
import { EntriesState, type SaveResult } from '../entries/entries.state';
import { colorHex } from '../entries/colors';
import { hectaresText } from '../entries/formats';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapState } from '../map/map.state';
import { AddEntryState, type Location } from './add-entry.state';
import { FindFormComponent, type FindSubmission } from './find-form.component';
import { asPolygon, loadAreaCalculator, type AreaCalculator } from './area';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';
import { ZONE_DRAWER, type DrawSession } from './zone-drawer';

/** Blätter, die nur einen Satz und eine Fußleiste tragen, folgen dem Inhalt. */
const DETENTS_CONTENT: readonly [DetentSize, DetentSize, DetentSize] = ['inhalt', 'inhalt', 'inhalt'];

/** Das Formular steht auf 150 von 844 px, so wie im Artboard `MeldenFormular`. */
const DETENTS_FORM: readonly [DetentSize, DetentSize, DetentSize] = [0.82, 0.82, 0.82];

/**
 * Der Ablauf hinter dem Plus-Knopf über der Karte: Aktionsblatt, Fadenkreuz,
 * Formular (Artboards `KarteAktionen`, `MeldenOrt`, `MeldenFormular`,
 * `ZoneZeichnen`).
 *
 * Die Komponente liegt über der Karte und sperrt sie, sobald es nichts mehr
 * zu schieben gibt. Solange das Fadenkreuz steht, bleibt die Karte frei.
 */
@Component({
  selector: 'app-add-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ActionRowComponent,
    ActionSheetComponent,
    SheetHeightDirective,
    CrosshairComponent,
    FindFormComponent,
    NoteComponent,
    ObjectFormComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './add-entry.component.html',
  styleUrl: './add-entry.component.scss',
})
export class AddEntryComponent implements OnDestroy {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly eintraege = inject(EntriesState);
  private readonly map = inject(MapState);
  private readonly draw = inject(ZONE_DRAWER);

  private readonly objectForm = viewChild(ObjectFormComponent);

  protected readonly state = inject(AddEntryState);
  /** Der untere Rand des freien Streifens: dort steht das Fadenkreuz. */
  protected readonly overlayHeight = this.map.overlayHeight;
  protected readonly detentsContent = DETENTS_CONTENT;
  protected readonly detentsForm = DETENTS_FORM;

  private readonly desktop = signal<AreaCalculator | null>(null);
  private session: DrawSession | null = null;
  private sessionRunning: Promise<DrawSession | null> | null = null;

  protected readonly saving = signal(false);
  /** Die Farbe, in der die Zone gerade gezeichnet wird. */
  protected readonly zoneColor = signal<Color>('gruen');

  protected readonly flaecheHa = computed(() => {
    const compute = this.desktop();
    const polygon = asPolygon(this.state.ring());
    return compute !== null && polygon !== null ? compute(polygon) : 0;
  });

  protected readonly drawInstructions = computed(() =>
    this.i18n.translate('zone.zeichnenAnleitung', {
      punkte: this.state.ring().length,
      flaeche: hectaresText(this.flaecheHa(), this.i18n.locale()),
    }),
  );

  protected readonly areaText = computed(() =>
    this.i18n.translate('zone.flaeche', { flaeche: hectaresText(this.flaecheHa(), this.i18n.locale()) }),
  );

  constructor() {
    // Terra Draw und Turf kommen erst, wenn eine Zone entsteht. Beide liegen in
    // eigenen Paketen und fehlen dem Erstpaket.
    effect(() => {
      const step = this.state.step();
      if (step !== 'zoneZeichnen' && step !== 'zoneFormular') {
        this.stopSession();
        return;
      }
      void this.prepareZone();
    });

    effect(() => {
      const ring = this.state.ring();
      this.session?.showRing(ring);
    });
  }

  ngOnDestroy(): void {
    this.stopSession();
  }

  protected startFind(): void {
    this.state.startFind();
  }

  protected startMarker(): void {
    this.state.startMarker();
  }

  protected startZone(): void {
    this.state.startZone();
  }

  protected cancel(): void {
    this.state.stop();
  }

  /** Übernimmt den Ort unter dem Fadenkreuz. */
  protected adoptLocation(): void {
    const location = this.center();
    if (location === null) return;
    this.state.adoptLocation(location);
  }

  protected addCorner(): void {
    const location = this.center();
    if (location === null) return;
    this.state.addCorner(location);
  }

  protected removeCorner(): void {
    this.state.removeLastCorner();
  }

  protected closeZone(): void {
    if (!this.state.closeZone()) this.toasts.error(this.i18n.translate('zone.zuWenigPunkte'));
  }

  protected async saveFind(submission: FindSubmission): Promise<void> {
    this.saving.set(true);
    try {
      this.report(await this.eintraege.saveFind(submission.input, submission.fotos), 'melden');
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveMarker(): Promise<void> {
    const values = this.objectForm()?.values();
    const location = this.state.location();
    if (!values || location === null) return;
    this.saving.set(true);
    try {
      const result = await this.eintraege.saveMarker({
        name: values.name,
        lat: location[1],
        lon: location[0],
        farbe: values.farbe,
        notiz: values.notiz,
        sichtbarkeit: values.sichtbarkeit,
      });
      this.report(result, 'marker');
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveZone(): Promise<void> {
    const values = this.objectForm()?.values();
    const polygon = asPolygon(this.state.ring());
    if (!values || polygon === null) return;
    this.saving.set(true);
    try {
      const result = await this.eintraege.saveZone({
        name: values.name,
        polygon,
        farbe: values.farbe,
        notiz: values.notiz,
        sichtbarkeit: values.sichtbarkeit,
      });
      this.report(result, 'zone');
    } finally {
      this.saving.set(false);
    }
  }

  /** Die Vorschau auf der Karte folgt der gewählten Farbe. */
  protected onZoneValues(values: ObjectValues): void {
    this.zoneColor.set(values.farbe);
  }

  private report(result: SaveResult, range: 'melden' | 'marker' | 'zone'): void {
    if (result === 'verworfen') {
      this.toasts.error(this.i18n.translate('melden.verworfen'));
      return;
    }
    this.toasts.success(this.i18n.translate(`${range}.${result}`));
    this.state.stop();
  }

  private center(): Location | null {
    const location = this.adapter.center();
    if (location === null) this.toasts.error(this.i18n.translate('eintragen.ortFehlt'));
    return location;
  }

  /** Holt Turf und Terra Draw und legt den Ring auf die Karte. */
  private async prepareZone(): Promise<void> {
    this.desktop.set(await loadAreaCalculator());
    const map = this.adapter.rawMap();
    if (map === null || this.sessionRunning !== null) return;
    this.sessionRunning = this.draw(map, colorHex(this.zoneColor()));
    this.session = await this.sessionRunning;
    this.session?.showRing(this.state.ring());
  }

  private stopSession(): void {
    this.session?.stop();
    this.session = null;
    this.sessionRunning = null;
    this.map.overlayHeight.set(0);
  }
}
