import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Fund, Marker, Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { KARTE_ADAPTER } from '../../map/karte.tokens';
import { NoteComponent, SheetComponent } from '../../ui';
import { EintraegeZustand } from '../eintraege/eintraege.zustand';
import { BlattHoeheDirective } from '../karte/blatt-hoehe.directive';
import { KartenZustand } from '../karte/karten-zustand';
import { FundBlattComponent } from './fund-blatt.component';
import { MarkerBlattComponent } from './marker-blatt.component';
import { ZoneBlattComponent } from './zone-blatt.component';

/** Das Objekt steht auf 250 von 844 px, so wie im Artboard `Fund`. */
const RASTEN: readonly [number, number, number] = [0.7, 0.7, 0.7];

/**
 * Das Blatt über der Karte, das ein Objekt zeigt (Artboards `Fund` und
 * `Zone`).
 *
 * Welches Objekt offen ist, steht in der Adresse: `?objekt=fund:<id>`. So
 * führt ein Tipp in der Liste auf dieselbe Ansicht wie ein Tipp auf der Karte,
 * und ein Zurück im Browser schließt das Blatt.
 */
@Component({
  selector: 'app-objekt-blatt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlattHoeheDirective,
    FundBlattComponent,
    MarkerBlattComponent,
    NoteComponent,
    SheetComponent,
    TranslatePipe,
    ZoneBlattComponent,
  ],
  templateUrl: './objekt-blatt.component.html',
  styleUrl: './objekt-blatt.component.scss',
})
export class ObjektBlattComponent {
  private readonly adapter = inject(KARTE_ADAPTER);
  private readonly eintraege = inject(EintraegeZustand);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly karte = inject(KartenZustand);
  protected readonly rasten = RASTEN;

  protected readonly fund = computed<Fund | null>(() => {
    const offen = this.karte.objekt();
    if (offen?.art !== 'fund') return null;
    return this.eintraege.funde().find((kandidat) => kandidat.id === offen.id) ?? null;
  });

  protected readonly marker = computed<Marker | null>(() => {
    const offen = this.karte.objekt();
    if (offen?.art !== 'marker') return null;
    return this.eintraege.marker().find((kandidat) => kandidat.id === offen.id) ?? null;
  });

  protected readonly zone = computed<Zone | null>(() => {
    const offen = this.karte.objekt();
    if (offen?.art !== 'zone') return null;
    return this.eintraege.zonen().find((kandidat) => kandidat.id === offen.id) ?? null;
  });

  /** Der Name des Blatts für Hilfsmittel: Fund, Marker oder Zone. */
  protected readonly blattName = computed(() => {
    const offen = this.karte.objekt();
    return offen === null ? '' : this.i18n.translate(`${offen.art}.blatt`);
  });

  /** Offen, aber nichts gefunden: der Eintrag ist fort oder gehört einem anderen Konto. */
  protected readonly fehlt = computed(
    () => this.karte.objekt() !== null && !this.fund() && !this.marker() && !this.zone(),
  );

  protected schliesse(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { objekt: null },
      queryParamsHandling: 'merge',
    });
  }

  protected zeigeAufKarte(ort: readonly [number, number]): void {
    this.adapter.fliegeZu(ort);
    this.schliesse();
  }
}
