import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { DETENTS_DEFAULT, SheetComponent, detentForHeight, detentInPx } from './sheet.component';

@Component({
  imports: [SheetComponent],
  template: `
    <app-sheet label="Steinpilz" [detent]="1" [modal]="true" [handleHint]="true">
      <button type="button">erste</button>
      <button type="button">zweite</button>
    </app-sheet>
  `,
})
class HostComponent {}

@Component({
  imports: [SheetComponent],
  template: `
    <app-sheet label="Karte" [detent]="1">
      <div head>
        <p>Kopfzeile</p>
        <button type="button">KW 40</button>
      </div>
      <p>Inhalt</p>
    </app-sheet>
  `,
})
class HeadHostComponent {}

/** jsdom misst nichts; das Blatt braucht aber eine Höhe, um zu rasten. */
function miss(host: HTMLElement, hostHeight: number, sheetHeight: number): void {
  Object.defineProperty(host, 'clientHeight', { value: hostHeight, configurable: true });
  const sheet = host.querySelector('.sheet');
  if (sheet) Object.defineProperty(sheet, 'clientHeight', { value: sheetHeight, configurable: true });
}

function drag(handle: HTMLElement, sizes: readonly number[]): void {
  const kinds = ['pointerdown', 'pointermove', 'pointerup'];
  sizes.forEach((clientY, i) => {
    handle.dispatchEvent(new MouseEvent(kinds[Math.min(i, 2)], { bubbles: true, clientY }));
  });
}

describe('SheetComponent', () => {
  it('ist ein Dialog mit Griff und Inhalt', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Steinpilz', handleHint: true },
    });

    expect(screen.getByRole('dialog', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blatt greifen' })).toBeInTheDocument();
    expect(screen.getByText(/Tippen wechselt die Raste/)).toBeInTheDocument();
    await noViolations(container);
  });

  it('geht beim Tipp auf den Griff zur nächsten Raste und wieder von vorn', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { label: 'Steinpilz', detent: 2 },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));

    await userEvent.click(screen.getByRole('button', { name: 'Blatt greifen' }));

    expect(calls).toEqual([0]);
  });

  it('setzt die Höhe der gewählten Raste', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Steinpilz', detent: 2, detents: [0.1, 0.5, 0.9] },
    });

    expect(container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('90%');
  });

  it('hält den Tabulator im modalen Blatt', async () => {
    await render(HostComponent);
    const first = screen.getByRole('button', { name: 'erste' });
    const second = screen.getByRole('button', { name: 'zweite' });

    second.focus();
    await userEvent.tab();

    expect(document.activeElement).not.toBe(second);
    first.focus();
    await userEvent.tab({ shift: true });

    expect(document.activeElement).not.toBe(first);
  });

  it('lässt den Tabulator im nicht modalen Blatt laufen', async () => {
    const { container } = await render(SheetComponent, { inputs: { label: 'Steinpilz' } });
    const handle = screen.getByRole('button', { name: 'Blatt greifen' });
    handle.focus();

    await userEvent.tab();

    expect(container.querySelector('[aria-modal]')).toBeNull();
  });

  it('steht am Rechner als Spalte ohne Griff', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Steinpilz', column: true },
    });

    expect(screen.queryByRole('button', { name: 'Blatt greifen' })).not.toBeInTheDocument();
    expect(container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('100%');
  });

  it('stellt die Raste mit den Pfeiltasten ein und hält an den Enden', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { label: 'Steinpilz', detent: 2 },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    screen.getByRole('button', { name: 'Blatt greifen' }).focus();

    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(calls).toEqual([1, 0]);
  });

  it('geht beim Zug am Griff auf die nächstgelegene Raste und lässt den Tipp aus', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { label: 'Steinpilz', detent: 1 },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt greifen' });
    miss(fixture.nativeElement as HTMLElement, 800, 320);

    drag(handle, [500, 100, 100]);
    handle.click();

    expect(calls).toEqual([2]);
  });

  it('lässt ein Wackeln die Raste in Ruhe', async () => {
    const { fixture } = await render(SheetComponent, {
      inputs: { label: 'Steinpilz', detent: 1 },
    });
    const calls: number[] = [];
    fixture.componentInstance.detentChange.subscribe((detent) => calls.push(detent));
    const handle = screen.getByRole('button', { name: 'Blatt greifen' });
    miss(fixture.nativeElement as HTMLElement, 800, 320);

    drag(handle, [500, 495, 494]);

    expect(calls).toEqual([]);
  });
});

describe('Raste Inhalt', () => {
  it('lässt den Inhalt die Höhe des Blatts bestimmen', async () => {
    const { container } = await render(SheetComponent, {
      inputs: { label: 'Fundort festlegen', detents: ['inhalt', 'inhalt', 'inhalt'] as const },
    });

    expect(container.querySelector('.sheet')).toHaveStyle({ 'block-size': 'auto' });
  });
});

describe('Rasten', () => {
  it('rechnet Anteil und feste Höhe in Punkte um', () => {
    expect(detentInPx(0.4, 800)).toBe(320);
    expect(detentInPx('152px', 800)).toBe(152);
    expect(DETENTS_DEFAULT[0]).toBe('152px');
  });

  it('nimmt für die Raste „Inhalt“ die gemessene Höhe', () => {
    expect(detentInPx('inhalt', 800, 240)).toBe(240);
    expect(detentInPx('inhalt', 800)).toBe(0);
  });

  it('nimmt die nächstgelegene Raste, erst ab der Schwelle', () => {
    const sizes: [number, number, number] = [152, 320, 720];

    expect(detentForHeight(sizes, 1, 700)).toBe(2);
    expect(detentForHeight(sizes, 1, 160)).toBe(0);
    expect(detentForHeight(sizes, 1, 330)).toBe(1);
    expect(detentForHeight(sizes, 0, 300)).toBe(1);
  });
});

/** Der Wirt des Blatts im Testaufbau. */
function wirtVon(container: Element): HTMLElement {
  const host = container.querySelector<HTMLElement>('app-sheet');
  if (!host) throw new Error('Kein Blatt im Wirt.');
  return host;
}

describe('SheetComponent, Ziehfläche', () => {
  it('zieht auch am Kopf, nicht nur am Griff', async () => {
    const { fixture, container } = await render(HeadHostComponent);
    const sheet = fixture.debugElement.children[0].componentInstance as SheetComponent;
    const calls: number[] = [];
    sheet.detentChange.subscribe((detent) => calls.push(detent));
    miss(wirtVon(container), 800, 320);
    const head = screen.getByText('Kopfzeile');

    drag(head, [500, 100, 100]);

    expect(calls).toEqual([2]);
  });

  it('lässt einen Tipp im Kopf ein Tipp bleiben', async () => {
    const { fixture, container } = await render(HeadHostComponent);
    const sheet = fixture.debugElement.children[0].componentInstance as SheetComponent;
    const calls: number[] = [];
    sheet.detentChange.subscribe((detent) => calls.push(detent));
    miss(wirtVon(container), 800, 320);
    const woche = screen.getByRole('button', { name: 'KW 40' });
    let tapped = 0;
    woche.addEventListener('click', () => (tapped += 1));

    drag(woche, [500, 497, 497]);
    woche.click();

    expect(calls).toEqual([]);
    expect(tapped).toBe(1);
  });
});
