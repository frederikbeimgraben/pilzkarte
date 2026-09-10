import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Die drei Rasten des Blatts, von unten nach oben. */
export type Detent = 0 | 1 | 2;

/**
 * Eine Raste ist ein Anteil der Wirtshöhe (0 bis 1), eine feste Höhe oder
 * `inhalt`. Die unterste Raste zeigt genau den Kopf; als Anteil würde sie auf
 * einem kurzen Telefon die Zeitleiste abschneiden.
 *
 * `inhalt` lässt den Inhalt die Höhe bestimmen. Blätter, die nur einen Satz
 * und eine Fußleiste tragen (Anmelden, Fundort, Aktionen), stünden mit einem
 * Anteil entweder gequetscht oder mit Leerraum zwischen Text und Knöpfen da.
 */
export type DetentSize = number | `${number}px` | 'inhalt';

/** Griff, Kopfzeile und Zeitleiste, wie sie das Artboard `KarteEingeklappt` zeigt. */
export const HEAD_HEIGHT = '152px';

/** Aus den Artboards `KarteEingeklappt` (Kopf), `Main` (halb) und `Zone` (voll). */
export const DETENTS_DEFAULT: readonly [DetentSize, DetentSize, DetentSize] = [HEAD_HEIGHT, 0.4, 0.9];

/** Erst ab dieser Bewegung in px zählt ein Zug als Zug und nicht als Tipp. */
export const DRAG_THRESHOLD = 24;

/**
 * Welche Raste eine Zugbewegung trifft: die nächstgelegene zur erreichten Höhe.
 * Unter der Schwelle bleibt die alte Raste, damit ein Wackeln nichts verstellt.
 */
export function detentForHeight(
  sizes: readonly [number, number, number],
  jetzt: Detent,
  hoehe: number,
  threshold = DRAG_THRESHOLD,
): Detent {
  if (Math.abs(hoehe - sizes[jetzt]) < threshold) return jetzt;
  let best: Detent = jetzt;
  for (const detent of [0, 1, 2] as const) {
    if (Math.abs(sizes[detent] - hoehe) < Math.abs(sizes[best] - hoehe)) best = detent;
  }
  return best;
}

/**
 * Rechnet ein Rastenmaß in Punkte um. `inhalt` kennt seine Höhe erst nach dem
 * Zeichnen; der Aufrufer reicht sie als `gemessen` herein.
 */
export function detentInPx(mass: DetentSize, hostHeight: number, measured = 0): number {
  if (mass === 'inhalt') return measured;
  return typeof mass === 'number' ? mass * hostHeight : Number.parseFloat(mass);
}

/**
 * Das Blatt über der Karte. Es liegt auf einer der drei Rasten; ein Tipp auf
 * den Griff geht zur nächsten, ein Zug am Griff zur nächstgelegenen, die
 * Pfeiltasten eine Stufe auf oder ab. Am Rechner wird daraus eine Spalte ohne
 * Rasten.
 */
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './sheet.component.html',
  styleUrl: './sheet.component.scss',
})
export class SheetComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);

  readonly label = input.required<string>();
  readonly detent = input<Detent>(1);
  readonly detents = input<readonly [DetentSize, DetentSize, DetentSize]>(DETENTS_DEFAULT);
  /** Ein Blatt, das die Karte sperrt (Melden, Anmelden), fängt den Fokus. */
  readonly modal = input(false);
  /** Der Griff-Tipp nennt die Bedienung, solange sie nicht offensichtlich ist. */
  readonly handleHint = input(false);
  /** Am Rechner steht das Blatt als volle Spalte neben der Karte. */
  readonly column = input(false);

  readonly detentChange = output<Detent>();

  /** Während eines Zugs führt der Finger, nicht die Raste. */
  private readonly dragged = signal<number | null>(null);
  private drag: { pointer: number; von: number; hoehe: number; moved: boolean } | null = null;

  protected readonly hoehe = computed(() => {
    if (this.column()) return '100%';
    const dragged = this.dragged();
    if (dragged !== null) return `${dragged}px`;
    const mass = this.detents()[this.detent()];
    if (mass === 'inhalt') return 'auto';
    return typeof mass === 'number' ? `${mass * 100}%` : mass;
  });

  protected handleText(): string {
    return this.i18n.translate('sheet.griff');
  }

  protected nextDetent(): void {
    if (this.drag?.moved) return;
    this.detentChange.emit(((this.detent() + 1) % 3) as Detent);
  }

  protected onHandleKey(event: KeyboardEvent): void {
    const step = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const target = Math.min(2, Math.max(0, this.detent() + step)) as Detent;
    if (target !== this.detent()) this.detentChange.emit(target);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.column()) return;
    this.drag = { pointer: event.pointerId, von: event.clientY, hoehe: this.sheetHeight(), moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointer !== event.pointerId) return;
    const hoehe = drag.hoehe + (drag.von - event.clientY);
    if (Math.abs(drag.von - event.clientY) > 4) drag.moved = true;
    this.dragged.set(Math.min(Math.max(hoehe, 0), this.hostHeight()));
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointer !== event.pointerId) return;
    const hoehe = this.dragged() ?? drag.hoehe;
    this.dragged.set(null);
    if (drag.moved) {
      const target = detentForHeight(this.sizesInPx(), this.detent(), hoehe);
      if (target !== this.detent()) this.detentChange.emit(target);
    }
    // Der Klick folgt gleich nach; `naechsteRaste` fragt darum noch nach `bewegt`.
    setTimeout(() => (this.drag = null));
  }

  /** Im modalen Blatt bleibt der Tabulator im Blatt. */
  protected onKey(event: KeyboardEvent): void {
    if (!this.modal() || event.key !== 'Tab') return;
    const targets = this.focusable();
    if (targets.length === 0) return;
    const first = targets[0];
    const last = targets[targets.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && active === last) {
      first.focus();
      event.preventDefault();
    }
  }

  private hostHeight(): number {
    return this.host.nativeElement.clientHeight || 0;
  }

  private sheetHeight(): number {
    return this.host.nativeElement.querySelector('.sheet')?.clientHeight ?? 0;
  }

  private sizesInPx(): [number, number, number] {
    const host = this.hostHeight();
    const measured = this.sheetHeight();
    const [a, b, c] = this.detents();
    return [detentInPx(a, host, measured), detentInPx(b, host, measured), detentInPx(c, host, measured)];
  }

  private focusable(): HTMLElement[] {
    const chosen =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(chosen));
  }
}
