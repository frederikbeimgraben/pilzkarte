import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { RASTEN_STANDARD, SheetComponent, rasteFuerHoehe, rasteInPx } from './sheet.component';

@Component({
  imports: [SheetComponent],
  template: `
    <app-sheet beschriftung="Steinpilz" [raste]="1" [modal]="true" [griffTipp]="true">
      <button type="button">erste</button>
      <button type="button">zweite</button>
    </app-sheet>
  `,
})
class WirtComponent {}

/** jsdom misst nichts; das Blatt braucht aber eine Höhe, um zu rasten. */
function miss(wirt: HTMLElement, wirtHoehe: number, blattHoehe: number): void {
  Object.defineProperty(wirt, 'clientHeight', { value: wirtHoehe, configurable: true });
  const blatt = wirt.querySelector('.blatt');
  if (blatt) Object.defineProperty(blatt, 'clientHeight', { value: blattHoehe, configurable: true });
}

function zieh(griff: HTMLElement, hoehen: readonly number[]): void {
  const typen = ['pointerdown', 'pointermove', 'pointerup'];
  hoehen.forEach((clientY, i) => {
    griff.dispatchEvent(new MouseEvent(typen[Math.min(i, 2)], { bubbles: true, clientY }));
  });
}

describe('SheetComponent', () => {
  it('ist ein Dialog mit Griff und Inhalt', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', griffTipp: true },
    });

    expect(screen.getByRole('dialog', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blatt greifen' })).toBeInTheDocument();
    expect(screen.getByText(/Tippen wechselt die Raste/)).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('geht beim Tipp auf den Griff zur nächsten Raste und wieder von vorn', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', raste: 2 },
    });
    const gerufen: number[] = [];
    fixture.componentInstance.rasteChange.subscribe((raste) => gerufen.push(raste));

    await userEvent.click(screen.getByRole('button', { name: 'Blatt greifen' }));

    expect(gerufen).toEqual([0]);
  });

  it('setzt die Höhe der gewählten Raste', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', raste: 2, rasten: [0.1, 0.5, 0.9] },
    });

    expect(container.querySelector<HTMLElement>('.blatt')?.style.blockSize).toBe('90%');
  });

  it('hält den Tabulator im modalen Blatt', async () => {
    await render(WirtComponent);
    const erste = screen.getByRole('button', { name: 'erste' });
    const zweite = screen.getByRole('button', { name: 'zweite' });

    zweite.focus();
    await userEvent.tab();

    expect(document.activeElement).not.toBe(zweite);
    erste.focus();
    await userEvent.tab({ shift: true });

    expect(document.activeElement).not.toBe(erste);
  });

  it('lässt den Tabulator im nicht modalen Blatt laufen', async () => {
    const { container } = await render(SheetComponent, { inputs: { beschriftung: 'Steinpilz' } });
    const griff = screen.getByRole('button', { name: 'Blatt greifen' });
    griff.focus();

    await userEvent.tab();

    expect(container.querySelector('[aria-modal]')).toBeNull();
  });

  it('steht am Rechner als Spalte ohne Griff', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', spalte: true },
    });

    expect(screen.queryByRole('button', { name: 'Blatt greifen' })).not.toBeInTheDocument();
    expect(container.querySelector<HTMLElement>('.blatt')?.style.blockSize).toBe('100%');
  });

  it('stellt die Raste mit den Pfeiltasten ein und hält an den Enden', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', raste: 2 },
    });
    const gerufen: number[] = [];
    fixture.componentInstance.rasteChange.subscribe((raste) => gerufen.push(raste));
    screen.getByRole('button', { name: 'Blatt greifen' }).focus();

    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(gerufen).toEqual([1, 0]);
  });

  it('geht beim Zug am Griff auf die nächstgelegene Raste und lässt den Tipp aus', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', raste: 1 },
    });
    const gerufen: number[] = [];
    fixture.componentInstance.rasteChange.subscribe((raste) => gerufen.push(raste));
    const griff = screen.getByRole('button', { name: 'Blatt greifen' });
    miss(fixture.nativeElement as HTMLElement, 800, 320);

    zieh(griff, [500, 100, 100]);
    griff.click();

    expect(gerufen).toEqual([2]);
  });

  it('lässt ein Wackeln die Raste in Ruhe', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { beschriftung: 'Steinpilz', raste: 1 },
    });
    const gerufen: number[] = [];
    fixture.componentInstance.rasteChange.subscribe((raste) => gerufen.push(raste));
    const griff = screen.getByRole('button', { name: 'Blatt greifen' });
    miss(fixture.nativeElement as HTMLElement, 800, 320);

    zieh(griff, [500, 495, 494]);

    expect(gerufen).toEqual([]);
  });
});

describe('Raste Inhalt', () => {
  it('lässt den Inhalt die Höhe des Blatts bestimmen', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { beschriftung: 'Fundort festlegen', rasten: ['inhalt', 'inhalt', 'inhalt'] as const },
    });

    expect(container.querySelector('.blatt')).toHaveStyle({ 'block-size': 'auto' });
  });
});

describe('Rasten', () => {
  it('rechnet Anteil und feste Höhe in Punkte um', () => {
    expect(rasteInPx(0.4, 800)).toBe(320);
    expect(rasteInPx('152px', 800)).toBe(152);
    expect(RASTEN_STANDARD[0]).toBe('152px');
  });

  it('nimmt für die Raste „Inhalt“ die gemessene Höhe', () => {
    expect(rasteInPx('inhalt', 800, 240)).toBe(240);
    expect(rasteInPx('inhalt', 800)).toBe(0);
  });

  it('nimmt die nächstgelegene Raste, erst ab der Schwelle', () => {
    const hoehen: [number, number, number] = [152, 320, 720];

    expect(rasteFuerHoehe(hoehen, 1, 700)).toBe(2);
    expect(rasteFuerHoehe(hoehen, 1, 160)).toBe(0);
    expect(rasteFuerHoehe(hoehen, 1, 330)).toBe(1);
    expect(rasteFuerHoehe(hoehen, 0, 300)).toBe(1);
  });
});
