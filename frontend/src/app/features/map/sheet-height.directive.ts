import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { MapState } from './map.state';

/**
 * Meldet die Höhe eines Blatts über der Karte an den Kartenzustand.
 *
 * Die Karte braucht sie zweimal: als Polster, damit ihre Mitte im freien
 * Streifen liegt, und als unteren Rand für das Fadenkreuz. Ein Blatt der
 * Raste „Inhalt“ kennt seine Höhe erst nach dem Zeichnen, darum wird sie
 * gemessen und nicht gerechnet.
 */
@Directive({ selector: '[appSheetHeight]' })
export class SheetHeightDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly state = inject(MapState);

  private readonly observer = new ResizeObserver(() => {
    this.report();
  });

  constructor() {
    this.observer.observe(this.host.nativeElement);
    this.report();
  }

  ngOnDestroy(): void {
    this.observer.disconnect();
    this.state.overlayHeight.set(0);
  }

  private report(): void {
    const sheet = this.host.nativeElement.querySelector('.sheet');
    this.state.overlayHeight.set(sheet?.clientHeight ?? 0);
  }
}
