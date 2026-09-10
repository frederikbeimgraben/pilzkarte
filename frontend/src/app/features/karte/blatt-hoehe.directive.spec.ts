import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { BlattHoeheDirective } from './blatt-hoehe.directive';
import { KartenZustand } from './karten-zustand';

@Component({
  imports: [BlattHoeheDirective],
  template: `
    @if (offen()) {
      <div appBlattHoehe>
        @if (mitBlatt()) {
          <div class="blatt"></div>
        }
      </div>
    }
  `,
})
class WirtComponent {
  readonly offen = signal(true);
  readonly mitBlatt = signal(true);
}

/** Der Beobachter des Tests: er meldet erst, wenn der Test es sagt. */
function beobachter(): { melde: () => void } {
  const griff = { melde: (): void => undefined };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(rueckruf: () => void) {
        griff.melde = rueckruf;
      }
      observe(): void {
        // Ohne Layout ändert sich keine Größe von selbst.
      }
      disconnect(): void {
        // Es gibt nichts zu lösen.
      }
    },
  );
  return griff;
}

/** jsdom rechnet kein Layout; ein Blatt ist hier so hoch, wie der Test sagt. */
function blattHoeheStellen(hoehe: number): void {
  const echt = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(this: Element) {
      return this.classList.contains('blatt') ? hoehe : 0;
    },
  });
  if (echt) afterEach(() => Object.defineProperty(Element.prototype, 'clientHeight', echt));
}

describe('BlattHoeheDirective', () => {
  it('meldet die Höhe des Blatts an den Kartenzustand', async () => {
    const griff = beobachter();
    blattHoeheStellen(240);
    await render(WirtComponent);

    griff.melde();

    expect(TestBed.inject(KartenZustand).ueberlagerung()).toBe(240);
  });

  it('meldet null, solange im Wirt kein Blatt steht', async () => {
    const griff = beobachter();
    blattHoeheStellen(240);
    const { fixture, detectChanges } = await render(WirtComponent);
    fixture.componentInstance.mitBlatt.set(false);
    detectChanges();

    griff.melde();

    expect(TestBed.inject(KartenZustand).ueberlagerung()).toBe(0);
  });

  it('stellt die Überlagerung zurück, sobald das Blatt geht', async () => {
    const { fixture, detectChanges } = await render(WirtComponent);
    const zustand = TestBed.inject(KartenZustand);
    zustand.ueberlagerung.set(240);

    fixture.componentInstance.offen.set(false);
    detectChanges();

    expect(zustand.ueberlagerung()).toBe(0);
  });
});
