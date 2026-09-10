import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SheetHeightDirective } from './sheet-height.directive';
import { MapState } from './map.state';

@Component({
  imports: [SheetHeightDirective],
  template: `
    @if (open()) {
      <div appSheetHeight>
        @if (withSheet()) {
          <div class="sheet"></div>
        }
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(true);
  readonly withSheet = signal(true);
}

/** Der Beobachter des Tests: er meldet erst, wenn der Test es sagt. */
function observer(): { report: () => void } {
  const handle = { report: (): void => undefined };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        handle.report = callback;
      }
      observe(): void {
        // Ohne Layout ändert sich keine Größe von selbst.
      }
      disconnect(): void {
        // Es gibt nichts zu lösen.
      }
    },
  );
  return handle;
}

/** jsdom rechnet kein Layout; ein Blatt ist hier so hoch, wie der Test sagt. */
function stubSheetHeight(hoehe: number): void {
  const real = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(this: Element) {
      return this.classList.contains('sheet') ? hoehe : 0;
    },
  });
  if (real) afterEach(() => Object.defineProperty(Element.prototype, 'clientHeight', real));
}

describe('BlattHoeheDirective', () => {
  it('meldet die Höhe des Blatts an den Kartenzustand', async () => {
    const handle = observer();
    stubSheetHeight(240);
    await render(HostComponent);

    handle.report();

    expect(TestBed.inject(MapState).overlayHeight()).toBe(240);
  });

  it('meldet null, solange im Wirt kein Blatt steht', async () => {
    const handle = observer();
    stubSheetHeight(240);
    const { fixture, detectChanges } = await render(HostComponent);
    fixture.componentInstance.withSheet.set(false);
    detectChanges();

    handle.report();

    expect(TestBed.inject(MapState).overlayHeight()).toBe(0);
  });

  it('stellt die Überlagerung zurück, sobald das Blatt geht', async () => {
    const { fixture, detectChanges } = await render(HostComponent);
    const state = TestBed.inject(MapState);
    state.overlayHeight.set(240);

    fixture.componentInstance.open.set(false);
    detectChanges();

    expect(state.overlayHeight()).toBe(0);
  });
});
