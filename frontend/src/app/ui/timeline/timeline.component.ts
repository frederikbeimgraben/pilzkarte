import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { WeekButtonComponent } from './week-button.component';

/** Eine Woche des Manifests. `anteil` ist `mean` geteilt durch den Höchstwert. */
export interface ZeitleisteWoche {
  jahr: number;
  woche: number;
  anteil: number;
  prognose: boolean;
}

interface AngezeigteWoche extends ZeitleisteWoche {
  jahresmarke: boolean;
  schluessel: string;
}

/**
 * Die Wochen einer Art nebeneinander. Die Jahresmarke wird abgeleitet, damit
 * der Aufrufer nur die Wochen des Manifests reichen muss.
 */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekButtonComponent],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent {
  readonly wochen = input.required<readonly ZeitleisteWoche[]>();
  readonly aktiv = input<{ jahr: number; woche: number } | null>(null);
  readonly beschriftung = input.required<string>();

  readonly auswahl = output<ZeitleisteWoche>();

  protected readonly angezeigt = computed<AngezeigteWoche[]>(() =>
    this.wochen().map((woche, i, alle) => ({
      ...woche,
      jahresmarke: i > 0 && alle[i - 1].jahr !== woche.jahr,
      schluessel: `${woche.jahr}-${woche.woche}`,
    })),
  );

  protected istAktiv(woche: ZeitleisteWoche): boolean {
    const aktiv = this.aktiv();
    return aktiv !== null && aktiv.jahr === woche.jahr && aktiv.woche === woche.woche;
  }
}
