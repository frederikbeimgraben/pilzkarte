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

  it('lässt einen langen Schlüssel umbrechen, statt in den Wert zu laufen', async () => {
    // „Ölbaumtrichterling“ in der Verwechslungstabelle: 18 Zeichen sind breiter
    // als die 104 px der Mockups. jsdom setzt nichts; geprüft wird die Regel,
    // die den Umbruch erzwingt und die Spalte begrenzt.
    const { container } = await render(
      `<app-key-value-row schluessel="Ölbaumtrichterling XXXXXX"
         value="Leuchtet im Dunkeln, Lamellen laufen am Stiel herab, wächst büschelig an Wurzeln von Ölbaum und Eiche. Giftig." />`,
      { imports: [KeyValueRowComponent] },
    );

    const styles = styleOf(container.querySelector('app-key-value-row'));
    const schluessel = styleOf(container.querySelector('.tz__key'));

    expect(styles.gridTemplateColumns).toBe('minmax(104px, max-content) minmax(0, 1fr)');
    expect(styles.alignItems).toBe('start');
    expect(schluessel.maxInlineSize).toBe('145px');
    expect(schluessel.overflowWrap).toBe('anywhere');
  });
});
