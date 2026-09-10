import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  viewChildren,
} from '@angular/core';
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
 * der Aufrufer nur die Wochen des Manifests reichen muss. Die Leiste ist ein
 * einziges Tabulatorziel; die Pfeiltasten laufen darin weiter, wie bei einer
 * Werkzeugleiste.
 */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekButtonComponent],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent {
  private readonly knoepfe = viewChildren(WeekButtonComponent);

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

  protected readonly aktivIndex = computed(() => {
    const aktiv = this.aktiv();
    if (!aktiv) return 0;
    const index = this.wochen().findIndex((w) => w.jahr === aktiv.jahr && w.woche === aktiv.woche);
    return index < 0 ? 0 : index;
  });

  constructor() {
    // Die gewählte Woche muss sichtbar sein, auch wenn sie über einen Deep Link
    // oder die Pfeile im Kopf gesetzt wurde und weit außerhalb liegt.
    effect(() => {
      const knopf = this.knoepfe()[this.aktivIndex()] as WeekButtonComponent | undefined;
      knopf?.zeige(false);
    });
  }

  protected istAktiv(woche: ZeitleisteWoche): boolean {
    const aktiv = this.aktiv();
    return aktiv !== null && aktiv.jahr === woche.jahr && aktiv.woche === woche.woche;
  }

  protected beiTaste(ereignis: KeyboardEvent): void {
    const wochen = this.wochen();
    if (wochen.length === 0) return;
    const ziel = this.zielIndex(ereignis.key, wochen.length);
    if (ziel === null) return;
    ereignis.preventDefault();
    this.auswahl.emit(wochen[ziel]);
    (this.knoepfe()[ziel] as WeekButtonComponent | undefined)?.zeige(true);
  }

  private zielIndex(taste: string, anzahl: number): number | null {
    const jetzt = this.aktivIndex();
    if (taste === 'ArrowRight') return Math.min(anzahl - 1, jetzt + 1);
    if (taste === 'ArrowLeft') return Math.max(0, jetzt - 1);
    if (taste === 'Home') return 0;
    if (taste === 'End') return anzahl - 1;
    return null;
  }
}
