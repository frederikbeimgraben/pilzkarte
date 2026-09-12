import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { KeyValueRowComponent } from './key-value-row.component';
import { KeyValueTableComponent } from './key-value-table.component';

@Component({
  imports: [KeyValueTableComponent, KeyValueRowComponent],
  template: `
    <app-key-value-table>
      <app-key-value-row schluessel="Hut" value="6 bis 25 cm" />
      <app-key-value-row schluessel="Speisewert"><span>Speisepilz</span></app-key-value-row>
    </app-key-value-table>
  `,
})
class HostComponent {}

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('KeyValueTableComponent', () => {
  it('zeigt Schlüssel und Wert je Zeile', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByText('Hut')).toBeInTheDocument();
    expect(screen.getByText('6 bis 25 cm')).toBeInTheDocument();
    await noViolations(container);
  });

  it('nimmt einen reichen Wert als Inhalt an', async () => {
    await render(HostComponent);

    expect(screen.getByText('Speisepilz')).toBeInTheDocument();
  });

  it('trägt das Raster an der Tabelle, nicht an der Zeile', async () => {
    // Solange jede Zeile ihre Spalten selbst setzte, war die Spalte so breit
    // wie der Inhalt der Zeile: „Stiel“ mit der Unterzeile „schwarzbraun,
    // weiß“ stand 2 px weiter rechts als „Hut“ darüber. Das Mockup nennt feste
    // 104 px, und die halten nur alle Zeilen zusammen ein.
    const { container } = await render(HostComponent);

    const table = styleOf(container.querySelector('app-key-value-table'));
    expect(table.getPropertyValue('--pilz-kv-label')).toBe('104px');
    expect(table.gridTemplateColumns).toContain('minmax(0, 1fr)');
    expect(styleOf(container.querySelector('app-key-value-row')).display).toBe('contents');
    // Kein Rasterabstand: eine Lücke zwischen den Zellen schnitte Zebra und
    // Trennlinie in zwei Hälften. Der Abstand steckt im Polster.
    expect(table.columnGap).not.toBe('12px');
  });

  it('lässt einen langen Schlüssel umbrechen, statt in den Wert zu laufen', async () => {
    // „Ölbaumtrichterling“ ist breiter als die 104 px der Mockups. jsdom setzt
    // nichts; geprüft wird die Regel, die den Umbruch erzwingt.
    const { container } = await render(
      `<app-key-value-row schluessel="Ölbaumtrichterling XXXXXX" value="Giftig." />`,
      { imports: [KeyValueRowComponent] },
    );

    expect(styleOf(container.querySelector('.tz__key')).overflowWrap).toBe('anywhere');
  });

  it('setzt den Wert an die rechte Kante', async () => {
    // Eine Farbfläche von 96 px stand linksbündig in einer Spalte von 212 und
    // ließ ein Drittel der Karte leer.
    const { container } = await render(HostComponent);

    const value = styleOf(container.querySelector('.tz__value'));
    expect(value.alignItems).toBe('flex-end');
    expect(value.textAlign).toBe('end');
  });

  it('lässt Fließtext links beginnen', async () => {
    const { container } = await render(
      `<app-key-value-row schluessel="Hut" value="Vier Zeilen Prosa." [flow]="true" />`,
      { imports: [KeyValueRowComponent] },
    );

    const value = styleOf(container.querySelector('.tz__value'));
    expect(value.alignItems).toBe('flex-start');
    expect(value.textAlign).toBe('start');
  });
});
