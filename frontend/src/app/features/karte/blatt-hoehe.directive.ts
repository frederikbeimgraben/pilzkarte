import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { KartenZustand } from './karten-zustand';

/**
 * Meldet die Höhe eines Blatts über der Karte an den Kartenzustand.
 *
 * Die Karte braucht sie zweimal: als Polster, damit ihre Mitte im freien
 * Streifen liegt, und als unteren Rand für das Fadenkreuz. Ein Blatt der
 * Raste „Inhalt“ kennt seine Höhe erst nach dem Zeichnen, darum wird sie
 * gemessen und nicht gerechnet.
 */
@Directive({ selector: '[appBlattHoehe]' })
export class BlattHoeheDirective implements OnDestroy {
  private readonly wirt = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zustand = inject(KartenZustand);

  private readonly beobachter = new ResizeObserver(() => {
    this.melde();
  });

  constructor() {
    this.beobachter.observe(this.wirt.nativeElement);
    this.melde();
  }

  ngOnDestroy(): void {
    this.beobachter.disconnect();
    this.zustand.ueberlagerung.set(0);
  }

  private melde(): void {
    const blatt = this.wirt.nativeElement.querySelector('.blatt');
    this.zustand.ueberlagerung.set(blatt?.clientHeight ?? 0);
  }
}
