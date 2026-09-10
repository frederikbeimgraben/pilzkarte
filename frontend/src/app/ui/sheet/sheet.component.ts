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
export type Raste = 0 | 1 | 2;

/**
 * Eine Raste ist ein Anteil der Wirtshöhe (0 bis 1), eine feste Höhe oder
 * `inhalt`. Die unterste Raste zeigt genau den Kopf; als Anteil würde sie auf
 * einem kurzen Telefon die Zeitleiste abschneiden.
 *
 * `inhalt` lässt den Inhalt die Höhe bestimmen. Blätter, die nur einen Satz
 * und eine Fußleiste tragen (Anmelden, Fundort, Aktionen), stünden mit einem
 * Anteil entweder gequetscht oder mit Leerraum zwischen Text und Knöpfen da.
 */
export type RasteMass = number | `${number}px` | 'inhalt';

/** Griff, Kopfzeile und Zeitleiste, wie sie das Artboard `KarteEingeklappt` zeigt. */
export const KOPF_HOEHE = '152px';

/** Aus den Artboards `KarteEingeklappt` (Kopf), `Main` (halb) und `Zone` (voll). */
export const RASTEN_STANDARD: readonly [RasteMass, RasteMass, RasteMass] = [KOPF_HOEHE, 0.4, 0.9];

/** Erst ab dieser Bewegung in px zählt ein Zug als Zug und nicht als Tipp. */
export const ZUG_SCHWELLE = 24;

/**
 * Welche Raste eine Zugbewegung trifft: die nächstgelegene zur erreichten Höhe.
 * Unter der Schwelle bleibt die alte Raste, damit ein Wackeln nichts verstellt.
 */
export function rasteFuerHoehe(
  hoehen: readonly [number, number, number],
  jetzt: Raste,
  hoehe: number,
  schwelle = ZUG_SCHWELLE,
): Raste {
  if (Math.abs(hoehe - hoehen[jetzt]) < schwelle) return jetzt;
  let beste: Raste = jetzt;
  for (const raste of [0, 1, 2] as const) {
    if (Math.abs(hoehen[raste] - hoehe) < Math.abs(hoehen[beste] - hoehe)) beste = raste;
  }
  return beste;
}

/**
 * Rechnet ein Rastenmaß in Punkte um. `inhalt` kennt seine Höhe erst nach dem
 * Zeichnen; der Aufrufer reicht sie als `gemessen` herein.
 */
export function rasteInPx(mass: RasteMass, wirtHoehe: number, gemessen = 0): number {
  if (mass === 'inhalt') return gemessen;
  return typeof mass === 'number' ? mass * wirtHoehe : Number.parseFloat(mass);
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
  private readonly wirt = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);

  readonly beschriftung = input.required<string>();
  readonly raste = input<Raste>(1);
  readonly rasten = input<readonly [RasteMass, RasteMass, RasteMass]>(RASTEN_STANDARD);
  /** Ein Blatt, das die Karte sperrt (Melden, Anmelden), fängt den Fokus. */
  readonly modal = input(false);
  /** Der Griff-Tipp nennt die Bedienung, solange sie nicht offensichtlich ist. */
  readonly griffTipp = input(false);
  /** Am Rechner steht das Blatt als volle Spalte neben der Karte. */
  readonly spalte = input(false);

  readonly rasteChange = output<Raste>();

  /** Während eines Zugs führt der Finger, nicht die Raste. */
  private readonly gezogen = signal<number | null>(null);
  private zug: { zeiger: number; von: number; hoehe: number; bewegt: boolean } | null = null;

  protected readonly hoehe = computed(() => {
    if (this.spalte()) return '100%';
    const gezogen = this.gezogen();
    if (gezogen !== null) return `${gezogen}px`;
    const mass = this.rasten()[this.raste()];
    if (mass === 'inhalt') return 'auto';
    return typeof mass === 'number' ? `${mass * 100}%` : mass;
  });

  protected griffText(): string {
    return this.i18n.translate('sheet.griff');
  }

  protected naechsteRaste(): void {
    if (this.zug?.bewegt) return;
    this.rasteChange.emit(((this.raste() + 1) % 3) as Raste);
  }

  protected beiGriffTaste(ereignis: KeyboardEvent): void {
    const schritt = ereignis.key === 'ArrowUp' ? 1 : ereignis.key === 'ArrowDown' ? -1 : 0;
    if (schritt === 0) return;
    ereignis.preventDefault();
    const ziel = Math.min(2, Math.max(0, this.raste() + schritt)) as Raste;
    if (ziel !== this.raste()) this.rasteChange.emit(ziel);
  }

  protected beiZeigerAb(ereignis: PointerEvent): void {
    if (this.spalte()) return;
    this.zug = { zeiger: ereignis.pointerId, von: ereignis.clientY, hoehe: this.blattHoehe(), bewegt: false };
    (ereignis.currentTarget as HTMLElement).setPointerCapture(ereignis.pointerId);
  }

  protected beiZeigerZug(ereignis: PointerEvent): void {
    const zug = this.zug;
    if (zug?.zeiger !== ereignis.pointerId) return;
    const hoehe = zug.hoehe + (zug.von - ereignis.clientY);
    if (Math.abs(zug.von - ereignis.clientY) > 4) zug.bewegt = true;
    this.gezogen.set(Math.min(Math.max(hoehe, 0), this.wirtHoehe()));
  }

  protected beiZeigerAuf(ereignis: PointerEvent): void {
    const zug = this.zug;
    if (zug?.zeiger !== ereignis.pointerId) return;
    const hoehe = this.gezogen() ?? zug.hoehe;
    this.gezogen.set(null);
    if (zug.bewegt) {
      const ziel = rasteFuerHoehe(this.hoehenInPx(), this.raste(), hoehe);
      if (ziel !== this.raste()) this.rasteChange.emit(ziel);
    }
    // Der Klick folgt gleich nach; `naechsteRaste` fragt darum noch nach `bewegt`.
    setTimeout(() => (this.zug = null));
  }

  /** Im modalen Blatt bleibt der Tabulator im Blatt. */
  protected beiTaste(ereignis: KeyboardEvent): void {
    if (!this.modal() || ereignis.key !== 'Tab') return;
    const ziele = this.fokussierbare();
    if (ziele.length === 0) return;
    const erstes = ziele[0];
    const letztes = ziele[ziele.length - 1];
    const aktiv = document.activeElement;
    if (ereignis.shiftKey && aktiv === erstes) {
      letztes.focus();
      ereignis.preventDefault();
    } else if (!ereignis.shiftKey && aktiv === letztes) {
      erstes.focus();
      ereignis.preventDefault();
    }
  }

  private wirtHoehe(): number {
    return this.wirt.nativeElement.clientHeight || 0;
  }

  private blattHoehe(): number {
    return this.wirt.nativeElement.querySelector('.blatt')?.clientHeight ?? 0;
  }

  private hoehenInPx(): [number, number, number] {
    const wirt = this.wirtHoehe();
    const gemessen = this.blattHoehe();
    const [a, b, c] = this.rasten();
    return [rasteInPx(a, wirt, gemessen), rasteInPx(b, wirt, gemessen), rasteInPx(c, wirt, gemessen)];
  }

  private fokussierbare(): HTMLElement[] {
    const auswahl =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(this.wirt.nativeElement.querySelectorAll<HTMLElement>(auswahl));
  }
}
