import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ManifestService } from '../../core/tiles/manifest.service';
import { LayersService } from '../../core/tiles/layers.service';
import {
  layerFolders,
  layerWeek,
  findLayer,
  formatValue,
  histogramFor,
  matchingWeek,
  type Layer,
  type LayersManifest,
} from '../../core/tiles/layers';
import { layerFromSpecies } from '../../core/tiles/species-as-layer';
import { FORECAST_SLUGS } from '../../core/tiles/tile-paths';
import {
  currentWeek,
  barShares,
  findWeek,
  tilesAtZoom,
  weekKey,
  type SpeciesManifest,
  type ManifestWeek,
} from '../../core/tiles/manifest';
import { visibleTiles } from '../../map/tile-grid';
import { GERMANY, MAX_BOUNDS, ZOOM_MAX, ZOOM_MIN, styleFor } from '../../map/background';
import type { Padding } from '../../map/map-adapter';
import { MAP_ADAPTER, MAP_PROVIDERS, VALUE_WORKER } from '../../map/map.tokens';
import {
  ValueProtocol,
  speciesSource,
  valueTemplate,
  type CombinationSourcePart,
} from '../../map/value-protocol';
import { FORECAST_RAMP } from '../../ui/ramp/ramp-colors';
import type { CombinationRule } from '../../map/value-colors';
import { ThemeService } from '../../core/theme/theme.service';
import {
  FloatingButtonComponent,
  NoteComponent,
  DETENTS_DEFAULT,
  RampComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  TimelineComponent,
  detentInPx,
  type Detent,
  type SegmentOption,
  type TimelineWeek,
} from '../../ui';
import { LayersSheetComponent } from './layers-sheet.component';
import { FactorSheetComponent } from './factor-sheet.component';
import { FactorPickerComponent } from './factor-picker.component';
import { KombinationComponent } from './combination.component';
import { boundFor, encodeFactors, combinationKey, replaceFactor, type Faktor } from './factors';
import { LayerListComponent } from './layer-list.component';
import { EntriesState } from '../entries/entries.state';
import { AddEntryComponent } from '../add-entry/add-entry.component';
import { AddEntryState } from '../add-entry/add-entry.state';
import { MapObjectsDirective } from '../objects/map-objects.directive';
import { ObjectSheetComponent } from '../objects/object-sheet.component';
import { VIEW_MODES, MapState, DEFAULT_LAYER } from './map.state';

/** Takt der Wiedergabe. 700 ms sind langsam genug, um eine Woche zu erkennen. */
const BEAT = 700;

/** So viele Wochen in jede Richtung werden vorgeladen. */
const LOOKAHEAD = 2;

/** Nach dem Standort-Knopf: nah genug für einen Waldweg. */
const ZOOM_LOCATION = 11;

/** Die Kennung der zusammengesetzten Quelle im Protokoll. */
const COMBINATION_SOURCE = 'kombi';

/** British Racing Green, falls das Theme keine Farbe hergibt. */
const MEAN_FALLBACK = '#004225';

/** Die Kennung einer Ebene im Protokoll, damit sie nicht mit einer Art kollidiert. */
export function layerSourceId(layer: Layer): string {
  return `ebene-${layer.id}`;
}

/**
 * Der Reiter Karte: Hintergrund von OpenFreeMap, darüber die Wertkacheln von
 * Vorhersage und Eingabe-Ebene, darunter das Blatt mit Kopf, Zeitleiste und
 * Legende.
 */
@Component({
  selector: 'app-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LayersSheetComponent,
    LayerListComponent,
    FactorSheetComponent,
    FactorPickerComponent,
    AddEntryComponent,
    KombinationComponent,
    FloatingButtonComponent,
    MapObjectsDirective,
    NoteComponent,
    ObjectSheetComponent,
    RampComponent,
    SegmentedComponent,
    SheetComponent,
    SheetHeadComponent,
    TimelineComponent,
    TranslatePipe,
  ],
  providers: MAP_PROVIDERS,
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnDestroy {
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly manifests = inject(ManifestService);
  private readonly layersService = inject(LayersService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly viewport = inject(ViewportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly protocol = new ValueProtocol(inject(VALUE_WORKER));

  /**
   * Nur die Zeichenfläche, ohne Blatt und Knöpfe. So steht die Karte am
   * Rechner neben einem anderen Reiter, ohne dessen Spalte zu belegen und ohne
   * unsichtbare Ziele in die Tastaturreihenfolge zu hängen.
   */
  readonly surfaceOnly = input(false);

  protected readonly state = inject(MapState);
  protected readonly addEntry = inject(AddEntryState);
  private readonly eintraege = inject(EntriesState);
  protected readonly wide = this.viewport.wide;

  /**
   * Nur die Karte, die gerade der Reiter ist, schreibt und liest die Adresse.
   * Sonst trüge der Reiter Arten die Abfragewerte der Karte, und ein Wechsel
   * dorthin setzte die Karte auf ihre Vorgaben zurück.
   */
  protected readonly ownsAddress = computed(() => !this.surfaceOnly());

  private readonly manifest = signal<SpeciesManifest | null>(null);
  private readonly layers = signal<LayersManifest | null>(null);
  private readonly ready = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly speciesLayers = signal<ReadonlyMap<string, Layer>>(new Map());

  protected readonly playing = signal(false);
  protected readonly layersSheetOpen = signal(false);
  /** Der Faktor, den der Screen `Faktor` gerade bearbeitet. */
  protected readonly openFactorValue = signal<Faktor | null>(null);
  protected readonly pickingFactor = signal(false);

  /**
   * Über der Karte liegt immer nur ein Blatt. Solange das Eintragen läuft oder
   * ein Objekt offen ist, tritt das Blatt der Karte zurück.
   */
  protected readonly overlaid = computed(() => this.addEntry.running() || this.state.object() !== null);

  protected readonly showsLayer = computed(() => this.state.viewMode() === 'ebene');
  protected readonly showsCombination = computed(() => this.state.viewMode() === 'kombination');

  protected readonly woche = computed<ManifestWeek | null>(() => {
    const manifest = this.manifest();
    if (!manifest) return null;
    const selected = this.state.woche();
    return (selected !== null ? findWeek(manifest, selected) : null) ?? currentWeek(manifest);
  });

  /** Ohne Wahl in der Adresse steht die Ebene aus dem Konzeptbeispiel vorn. */
  protected readonly layer = computed<Layer | null>(() => {
    const manifest = this.layers();
    if (!manifest) return null;
    return (
      findLayer(manifest, this.state.layer()) ??
      findLayer(manifest, DEFAULT_LAYER) ??
      manifest.layers.at(0) ??
      null
    );
  });

  /** Die Woche, die die Ebene wirklich zeigt. Das Wetter endet vor der Prognose. */
  protected readonly layerWeekActive = computed(() => {
    const layer = this.layer();
    const woche = this.woche();
    if (!layer || layer.fixed || !woche) return null;
    return matchingWeek(layer, layerWeek(woche.jahr, woche.woche));
  });

  /** Jede Quelle, die ein Faktor nennen kann: die Ebenen und die Arten. */
  protected readonly factorSources = computed<ReadonlyMap<string, Layer>>(() => {
    const alle = new Map<string, Layer>(this.speciesLayers());
    for (const layer of this.layers()?.layers ?? []) alle.set(layer.id, layer);
    return alle;
  });

  protected readonly activeWeekKey = computed(() => {
    const woche = this.woche();
    return woche ? layerWeek(woche.jahr, woche.woche) : null;
  });

  /** Die Quelle, die der Faktor-Screen gerade zeigt. */
  protected readonly factorLayer = computed<Layer | null>(() => {
    const factor = this.openFactorValue();
    return factor ? (this.factorSources().get(factor.source) ?? null) : null;
  });

  protected readonly factorHistogram = computed(() => {
    const layer = this.factorLayer();
    return layer ? histogramFor(layer, this.activeWeekKey()) : null;
  });

  protected readonly factorTimeScope = computed(() => {
    const layer = this.factorLayer();
    if (!layer) return '';
    return layer.fixed ? this.i18n.translate('faktor.konstant') : this.weekText();
  });

  protected readonly usedSources = computed(
    () => new Set(this.state.factors().map((factor) => factor.source)),
  );

  protected readonly speciesAsLayers = computed(() => [...this.speciesLayers().values()]);

  protected readonly bar = computed<TimelineWeek[]>(() => {
    const manifest = this.manifest();
    if (!manifest) return [];
    const anteile = barShares(manifest);
    return manifest.wochen.map((woche, i) => ({
      jahr: woche.jahr,
      woche: woche.woche,
      share: anteile[i],
      forecast: woche.forecast,
    }));
  });

  protected readonly speciesName = computed(() => this.i18n.translate(`art.${this.state.art()}`));

  /** Der Kopf nennt, was die Karte zeigt: die Art oder die Ebene. */
  protected readonly headTitle = computed(() => {
    if (this.showsCombination()) return this.i18n.translate('darstellung.kombination');
    if (this.showsLayer()) return this.layer()?.label ?? this.i18n.translate('darstellung.ebene');
    return this.speciesName();
  });

  protected readonly weekText = computed(() => {
    const woche = this.woche();
    return woche ? this.i18n.translate('zeitleiste.woche', { woche: woche.woche, jahr: woche.jahr }) : '';
  });

  protected readonly forecastHint = computed(() =>
    !this.showsLayer() && this.woche()?.forecast === true
      ? this.i18n.translate('karte.prognoseHinweis')
      : undefined,
  );

  /** Sagt unter der Zeitleiste, welche Woche die Ebene wirklich zeigt. */
  protected readonly layerHint = computed(() => {
    const layer = this.layer();
    if (!this.showsLayer() || !layer) return null;
    if (layer.fixed) return this.i18n.translate('ebene.giltFuerAlleWochen');
    const own = this.layerWeekActive();
    const woche = this.woche();
    if (own === null || !woche || own === layerWeek(woche.jahr, woche.woche)) return null;
    return this.i18n.translate('ebene.andereWoche', {
      woche: Number(own.slice(5)),
      jahr: Number(own.slice(0, 4)),
    });
  });

  /** Eine feste Ebene kennt keine Woche; die Leiste tritt dann zurück. */
  protected readonly fixedLayer = computed(() => this.showsLayer() && this.layer()?.fixed === true);

  protected readonly allLayers = computed(() => this.layers()?.layers ?? []);

  protected readonly rampTitle = computed(() => {
    if (this.showsCombination()) return this.i18n.translate('kombination.rampe');
    return this.showsLayer() ? (this.layer()?.label ?? '') : this.i18n.translate('karte.rampe');
  });

  protected readonly rampFrom = computed(() => {
    const layer = this.layer();
    if (this.showsCombination()) return this.i18n.translate('karte.rampeVon');
    if (!this.showsLayer()) return this.i18n.translate('karte.rampeVon');
    return layer ? formatValue(layer.low, layer, this.i18n.locale()) : '';
  });

  protected readonly rampTo = computed(() => {
    const layer = this.layer();
    if (this.showsCombination()) return this.i18n.translate('karte.prozent', { wert: 100 });
    if (!this.showsLayer()) {
      return this.i18n.translate('karte.prozent', {
        wert: Math.round((this.manifest()?.top ?? 0) * 100),
      });
    }
    return layer ? formatValue(layer.high, layer, this.i18n.locale()) : '';
  });

  protected readonly viewModes = computed<SegmentOption[]>(() =>
    VIEW_MODES.map((value) => ({ value, label: this.i18n.translate(`darstellung.${value}`) })),
  );

  constructor() {
    this.adapter.warmUp();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      if (!this.ownsAddress()) return;
      this.state.adopt({
        art: query.get('art'),
        kw: query.get('kw'),
        viewMode: query.get('darstellung'),
        layer: query.get('ebene'),
        opacity: query.get('deckkraft'),
        rule: query.get('regel'),
        f: query.get('f'),
        object: query.get('objekt'),
      });
    });

    // Wird die Karte wieder zum Reiter, trägt die Adresse ihren Zustand erneut.
    // Ein Link mit eigenen Werten bleibt unangetastet; den liest der Abschnitt
    // darüber, und er käme sonst unter die Räder.
    effect(() => {
      if (!this.ownsAddress()) return;
      untracked(() => {
        if (this.route.snapshot.queryParamMap.keys.length === 0) this.writeAddress();
      });
    });

    effect(() => {
      void this.loadManifest(this.state.art());
    });

    void this.loadLayers();

    effect(() => {
      if (this.showsCombination()) void this.loadSpecies();
    });

    // Der Stil folgt der Wahl, sonst dem Theme. Erst wenn die Karte steht.
    effect(() => {
      const style = styleFor(this.state.background(), this.theme.effective());
      if (this.ready()) this.adapter.setStyle(style);
    });

    effect(() => {
      this.putForecast();
    });

    effect(() => {
      this.addObjectLayer();
    });

    effect(() => {
      const opacity = this.state.opacity();
      const onLayer = this.showsLayer();
      if (!this.ready()) return;
      // Der Regler gilt der Ebene, die man gerade liest. Was darunter liegt,
      // bleibt voll deckend, sonst verschwände es mit.
      this.adapter.setOpacity('ebene', onLayer ? opacity : 1);
      this.adapter.setOpacity('vorhersage', onLayer ? 1 : opacity);
    });

    effect(() => {
      const detent = this.state.detent();
      const wide = this.wide();
      const overlaid = this.state.overlayHeight();
      if (this.ready()) this.adapter.setPadding(this.padding(detent, wide, overlaid));
    });

    // Die eigenen Einträge folgen dem Konto: nach einer Anmeldung kommen sie,
    // nach einer Abmeldung gehen sie. Was wartet, geht dann gleich mit hinaus.
    effect(() => {
      this.eintraege.signedIn();
      void this.loadEntries();
    });

    afterNextRender(() => {
      void this.startMap();
    });
  }

  ngOnDestroy(): void {
    this.stopPlaying();
    this.adapter.destroy();
    this.protocol.stop();
  }

  protected setDetent(detent: Detent): void {
    this.state.detent.set(detent);
  }

  protected setView(value: string): void {
    const selected = VIEW_MODES.find((viewMode) => viewMode === value);
    if (!selected) return;
    this.state.viewMode.set(selected);
    this.writeAddress();
  }

  protected setRule(rule: CombinationRule): void {
    this.state.rule.set(rule);
    this.writeAddress();
  }

  protected toggleFactor(choice: { factor: Faktor; active: boolean }): void {
    this.state.factors.set(replaceFactor(this.state.factors(), { ...choice.factor, active: choice.active }));
    this.writeAddress();
  }

  protected openFactor(factor: Faktor): void {
    this.openFactorValue.set(factor);
  }

  protected applyFactor(factor: Faktor): void {
    this.state.factors.set(replaceFactor(this.state.factors(), factor));
    this.openFactorValue.set(null);
    this.writeAddress();
  }

  protected removeFactor(factor: Faktor): void {
    this.state.factors.set(this.state.factors().filter((entry) => entry.source !== factor.source));
    this.openFactorValue.set(null);
    this.writeAddress();
  }

  /** Eine neue Quelle beginnt mit der oberen Hälfte ihrer Skala. */
  protected selectSource(layer: Layer): void {
    const center = layer.low + (layer.high - layer.low) / 2;
    const factor: Faktor = { source: layer.id, condition: 'ueber', von: center, bis: 0, active: true };
    this.state.factors.set(replaceFactor(this.state.factors(), factor));
    this.pickingFactor.set(false);
    this.openFactorValue.set(factor);
    this.writeAddress();
  }

  protected selectLayer(layer: Layer): void {
    this.state.layer.set(layer.id);
    this.writeAddress();
  }

  protected setOpacity(value: number): void {
    this.state.opacity.set(value);
    this.writeAddress();
  }

  protected selectWeek(woche: { jahr: number; woche: number }): void {
    this.stopPlaying();
    this.state.woche.set(weekKey(woche));
    this.writeAddress();
  }

  /** Eine Woche vor oder zurück, ohne über die Enden hinaus. */
  protected step(direction: 1 | -1): void {
    const manifest = this.manifest();
    const woche = this.woche();
    if (!manifest || !woche) return;
    const jetzt = manifest.wochen.indexOf(woche);
    const target = Math.min(manifest.wochen.length - 1, Math.max(0, jetzt + direction));
    if (target !== jetzt) this.selectWeek(manifest.wochen[target]);
  }

  protected togglePlay(): void {
    if (this.playing()) {
      this.stopPlaying();
      return;
    }
    this.playing.set(true);
    this.timer = setInterval(() => {
      const manifest = this.manifest();
      const woche = this.woche();
      if (!manifest || !woche) return;
      const next = manifest.wochen.indexOf(woche) + 1;
      if (next >= manifest.wochen.length) {
        this.stopPlaying();
        return;
      }
      this.state.woche.set(weekKey(manifest.wochen[next]));
      this.writeAddress();
    }, BEAT);
  }

  protected toSpecies(): void {
    void this.router.navigate(['/arten']);
  }

  /**
   * Der Plus-Knopf öffnet das Aktionsblatt (Artboard `KarteAktionen`). Andere
   * Blätter gehen dabei zu: über der Karte liegt immer nur eines.
   */
  protected openAddEntry(): void {
    this.layersSheetOpen.set(false);
    this.pickingFactor.set(false);
    this.openFactorValue.set(null);
    this.addEntry.open();
  }

  /** Die eigenen Einträge und danach, was noch auf dem Gerät wartet. */
  private async loadEntries(): Promise<void> {
    await this.eintraege.load();
    await this.eintraege.sendPending();
  }

  /** Geteilte Funde gelten für den Ausschnitt; ein Schwenk holt die neuen. */
  private async loadShared(): Promise<void> {
    const view = this.adapter.extent();
    if (view === null) return;
    await this.eintraege.loadShared(view.extent);
  }

  /** Zentriert die Karte auf den eigenen Standort. */
  protected toMyLocation(): void {
    navigator.geolocation.getCurrentPosition(
      (location) => {
        this.adapter.centerOn([location.coords.longitude, location.coords.latitude], ZOOM_LOCATION);
      },
      () => {
        // Kein Standort ist kein Fehler der App: der Nutzer hat abgelehnt, oder
        // im Wald steht kein Signal. Ein Toast sagt es und lässt die Karte stehen.
        this.toasts.error(this.i18n.translate('karte.ortFehler'));
      },
    );
  }

  private stopPlaying(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.playing.set(false);
  }

  private async loadManifest(slug: string): Promise<void> {
    try {
      const manifest = await this.manifests.get(slug);
      this.protocol.report(speciesSource(manifest.slug, manifest.top, manifest.existing));
      this.manifest.set(manifest);
      this.loadOverview(manifest);
      this.writeAddress();
    } catch {
      // Ohne Manifest bleibt die Hintergrundkarte stehen; das Blatt zeigt dann
      // keine Wochen. Ein Fehlerbild wäre hier nicht hilfreicher.
      this.manifest.set(null);
    }
  }

  /**
   * Die Manifeste aller Vorhersage-Arten, damit eine Art als Faktor taugt.
   * Erst wenn die Kombination aufgeht: elf Manifeste sind zusammen so groß wie
   * eine Kachel, aber niemand braucht sie auf der Vorhersage.
   */
  private async loadSpecies(): Promise<void> {
    if (this.speciesLayers().size > 0) return;
    const loaded = await Promise.all(
      FORECAST_SLUGS.map(async (slug) => {
        try {
          return await this.manifests.get(slug);
        } catch {
          return null;
        }
      }),
    );
    const alle = new Map<string, Layer>();
    for (const manifest of loaded) {
      if (manifest) alle.set(manifest.slug, layerFromSpecies(manifest, this.speciesNameOf(manifest.slug)));
    }
    this.speciesLayers.set(alle);
  }

  private speciesNameOf(slug: string): string {
    const known = FORECAST_SLUGS.find((entry) => entry === slug);
    return known ? this.i18n.translate(`art.${known}`) : slug;
  }

  private async loadLayers(): Promise<void> {
    try {
      this.layers.set(await this.layersService.get());
      // Erst jetzt steht fest, welche Ebene gilt. Vorher trug die Adresse
      // höchstens eine Kennung, jetzt trägt sie die aufgelöste Ebene.
      this.writeAddress();
    } catch {
      // Ohne `layers.json` bleibt die Darstellung Ebene leer. Vorhersage geht.
      this.layers.set(null);
    }
  }

  /**
   * Die groben Stufen der gewählten Woche, sofort nach dem Manifest.
   *
   * MapLibre ist an dieser Stelle noch nicht geladen. Wären die Kacheln erst
   * nach seinem Stil an der Reihe, käme die Vorhersage rund eine Sekunde nach
   * der Hintergrundkarte; so liegt sie schon im Speicher des Workers.
   */
  private loadOverview(manifest: SpeciesManifest): void {
    const woche = this.woche();
    if (!woche) return;
    this.protocol.prefetch(
      manifest.slug,
      [woche.tilePath],
      [...tilesAtZoom(manifest, manifest.zoomVon), ...tilesAtZoom(manifest, manifest.zoomVon + 1)],
    );
  }

  /** Die Vorhersage liegt unter der Ebene, wenn beide gefragt sind. */
  private putForecast(): void {
    const manifest = this.manifest();
    const woche = this.woche();
    // Die Kombination hängt an keiner Art; dort liegt keine Vorhersage darunter.
    const visible =
      this.state.viewMode() === 'vorhersage' || (this.showsLayer() && this.state.forecastBelow());
    if (!this.ready() || !manifest || !woche) return;
    this.adapter.showValue(
      'vorhersage',
      visible ? valueTemplate(manifest.slug, woche.tilePath) : null,
      manifest.bounds,
      manifest.zoomVon,
      manifest.zoomBis,
    );
    if (visible) this.loadNeighbours();
  }

  /**
   * Die obere Wertebene. Sie zeigt die Ebene, die Kombination oder, solange
   * der Faktor-Screen offen ist, die Quelle dieses Faktors: was man einstellt,
   * soll man auch sehen.
   */
  private addObjectLayer(): void {
    const manifest = this.layers();
    if (!this.ready()) return;
    const inProgress = this.factorLayer();
    if (inProgress && manifest) {
      this.addSource(inProgress, manifest);
      return;
    }
    if (this.showsCombination()) {
      this.putCombination();
      return;
    }
    const layer = this.layer();
    if (!this.showsLayer() || !manifest || !layer) {
      this.adapter.showValue('ebene', null, MAX_BOUNDS, ZOOM_MIN, ZOOM_MAX);
      return;
    }
    this.addSource(layer, manifest);
  }

  private addSource(layer: Layer, manifest: LayersManifest): void {
    this.protocol.report({
      id: layerSourceId(layer),
      scale: { art: 'spanne', low: layer.low, high: layer.high },
      colors: FORECAST_RAMP,
      existing: layer.existing,
    });
    const folder = layerFolders(layer, this.activeWeekKey());
    this.adapter.showValue(
      'ebene',
      folder === null ? null : valueTemplate(layerSourceId(layer), folder),
      manifest.bounds,
      layer.zoomVon,
      layer.zoomBis,
    );
  }

  /**
   * Die Kombination als eine zusammengesetzte Quelle. Der Schlüssel im Ordner
   * ändert sich mit jeder Bedingung; sonst zeigte MapLibre die Kacheln der
   * vorigen Regel weiter.
   */
  private putCombination(): void {
    const manifest = this.layers();
    const sources = this.factorSources();
    const woche = this.activeWeekKey();
    const parts: CombinationSourcePart[] = [];
    let zoomVon = ZOOM_MIN;
    let zoomBis = ZOOM_MAX;
    for (const factor of this.state.factors()) {
      const layer = sources.get(factor.source);
      if (!factor.active || !layer) continue;
      const folder = layerFolders(layer, woche);
      if (folder === null) continue;
      parts.push({ folder, bound: boundFor(factor, layer), existing: layer.existing });
      zoomVon = Math.max(zoomVon, layer.zoomVon);
      zoomBis = Math.min(zoomBis, layer.zoomBis);
    }
    if (!manifest || parts.length === 0 || zoomBis < zoomVon) {
      this.adapter.showValue('ebene', null, MAX_BOUNDS, ZOOM_MIN, ZOOM_MAX);
      return;
    }
    const rule = this.state.rule();
    this.protocol.reportCombination({
      id: COMBINATION_SOURCE,
      rule,
      colors: rule === 'schnitt' ? [this.intersectionColor()] : FORECAST_RAMP,
      parts,
    });
    const schluessel = combinationKey([
      rule,
      encodeFactors(this.state.factors()),
      woche ?? 'fest',
      this.theme.effective(),
    ]);
    this.adapter.showValue(
      'ebene',
      valueTemplate(COMBINATION_SOURCE, schluessel),
      manifest.bounds,
      zoomVon,
      zoomBis,
    );
  }

  /**
   * Die Farbe der Schnittmenge kommt aus dem Theme: der Worker malt Daten,
   * aber diese eine Farbe ist die Primärfarbe der App und muss im dunklen
   * Bild anders liegen als im hellen.
   */
  private intersectionColor(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : MEAN_FALLBACK;
  }

  private async startMap(): Promise<void> {
    await this.adapter.start(this.surface().nativeElement, {
      style: styleFor(this.state.background(), this.theme.effective()),
      centerPoint: [10.4, 51.2],
      zoom: ZOOM_MIN,
      minZoom: ZOOM_MIN,
      maxZoom: ZOOM_MAX,
      maxBounds: MAX_BOUNDS,
      protocol: { name: 'wert', resolve: this.protocol.resolve },
      compact: !this.wide(),
    });
    this.adapter.fitBounds(
      GERMANY,
      this.padding(this.state.detent(), this.wide(), this.state.overlayHeight()),
    );
    this.adapter.onMove(() => {
      this.loadNeighbours();
      void this.loadShared();
    });
    this.ready.set(true);
    void this.loadShared();
  }

  /**
   * Der freie Streifen der Karte. Die Karte rechnet ihre Mitte darauf, statt
   * hinter das Blatt zu zielen.
   */
  private padding(detent: Detent, wide: boolean, overlaid = 0): Padding {
    if (wide) return { top: 0, bottom: 0, left: 0, right: 0 };
    const hoehe = this.surface().nativeElement.clientHeight;
    // Liegt ein Blatt über der Karte, gilt seine Höhe: sonst zielte die Mitte
    // hinter das Blatt und das Fadenkreuz stünde woanders als der Ort.
    const sheet = overlaid > 0 ? overlaid : detentInPx(DETENTS_DEFAULT[detent], hoehe);
    return { top: 0, bottom: Math.round(sheet), left: 0, right: 0 };
  }

  private loadNeighbours(): void {
    const manifest = this.manifest();
    const woche = this.woche();
    const view = this.adapter.extent();
    if (!manifest || !woche || !view) return;
    const jetzt = manifest.wochen.indexOf(woche);
    const neighbours: string[] = [];
    const layerNeighbours: string[] = [];
    const layer = this.layer();
    for (let gap = 1; gap <= LOOKAHEAD; gap++) {
      for (const index of [jetzt + gap, jetzt - gap]) {
        const neighbour = manifest.wochen[index] as ManifestWeek | undefined;
        if (!neighbour) continue;
        neighbours.push(neighbour.tilePath);
        if (this.showsLayer() && layer && !layer.fixed) {
          const folder = layerFolders(layer, layerWeek(neighbour.jahr, neighbour.woche));
          if (folder !== null) layerNeighbours.push(folder);
        }
      }
    }
    const tiles = visibleTiles(view.extent, view.zoom, manifest.zoomVon, manifest.zoomBis);
    this.protocol.prefetch(manifest.slug, neighbours, tiles);
    if (layer && layerNeighbours.length > 0) {
      this.protocol.prefetch(layerSourceId(layer), layerNeighbours, tiles);
    }
  }

  private writeAddress(): void {
    if (!this.ownsAddress()) return;
    const woche = this.woche();
    const adresse = this.state.adresse();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        art: adresse.art,
        kw: woche ? weekKey(woche) : null,
        darstellung: adresse.viewMode === 'vorhersage' ? null : adresse.viewMode,
        // Solange die Ebenen noch nicht da sind, bleibt die Kennung aus der
        // Adresse stehen; sonst löschte der erste Schreibvorgang den Deep Link.
        ebene: this.showsLayer() ? (this.layer()?.id ?? this.state.layer()) : null,
        deckkraft: adresse.opacity === 100 ? null : adresse.opacity,
        regel: this.showsCombination() ? adresse.rule : null,
        f: this.showsCombination() ? adresse.f : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
