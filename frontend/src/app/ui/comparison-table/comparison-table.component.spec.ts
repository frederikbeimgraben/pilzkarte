import { Component } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ComparisonCellComponent } from './comparison-cell.component';
import { ComparisonRowComponent } from './comparison-row.component';
import { ComparisonTableComponent } from './comparison-table.component';

@Component({
  imports: [ComparisonTableComponent, ComparisonRowComponent, ComparisonCellComponent],
  template: `
    <app-comparison-table label="Steinpilz und Gallenröhrling" [columns]="columns">
      <app-comparison-row label="Hutbreite">
        <app-comparison-cell>4 – 20 cm</app-comparison-cell>
        <app-comparison-cell>4 – 12 cm</app-comparison-cell>
      </app-comparison-row>
      <app-comparison-row label="Geschmack" [differs]="true">
        <app-comparison-cell>mild</app-comparison-cell>
        <app-comparison-cell>bitter</app-comparison-cell>
      </app-comparison-row>
    </app-comparison-table>
  `,
})
class HostComponent {
  readonly columns = ['Steinpilz', 'Gallenröhrling'];
}

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('ComparisonTableComponent', () => {
  it('nennt jede Art in ihrer Spalte und die Tabelle selbst', async () => {
    const { container } = await render(HostComponent);

    const table = screen.getByRole('table', { name: 'Steinpilz und Gallenröhrling' });
    const heads = within(table).getAllByRole('columnheader');
    expect(heads.map((head) => head.textContent)).toEqual(['Merkmal', 'Steinpilz', 'Gallenröhrling']);
    await noViolations(container);
  });

  it('gibt jeder Zeile ihre Beschriftung und eine Zelle je Art', async () => {
    const rows = (await render(HostComponent)).container.querySelectorAll('app-comparison-row');

    expect(rows).toHaveLength(2);
    const cells = within(rows[0] as HTMLElement).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent.trim())).toEqual(['Hutbreite', '4 – 20 cm', '4 – 12 cm']);
  });

  it('legt eine feste Spur je Art an, nicht eine nach der Textlänge', async () => {
    const { container } = await render(HostComponent);

    // Reihen aus Flex hatten sich nach der Textlänge ausgerichtet, und die
    // Werte zweier Arten standen dann nicht mehr untereinander.
    const grid = container.querySelector<HTMLElement>('.comparison');
    expect(styleOf(grid).display).toBe('grid');
    expect(grid?.style.getPropertyValue('--comparison-columns')).toBe('2');
  });

  it('tönt eine Zeile mit Unterschied und lässt die anderen frei', async () => {
    const { container } = await render(HostComponent);

    const rows = [...container.querySelectorAll('app-comparison-row')];
    expect(rows[0].classList.contains('comparison__row--differs')).toBe(false);
    expect(rows[1].classList.contains('comparison__row--differs')).toBe(true);
    // Die Zellen lesen die Tönung als Eigenschaft, statt sie einzeln zu tragen.
    expect(styleOf(rows[1]).getPropertyValue('--comparison-tint')).toBe('var(--color-danger-bg)');
  });

  it('nimmt der Beschriftung das Gewicht des Werts', async () => {
    const { container } = await render(HostComponent);

    const label = container.querySelector('app-comparison-cell');
    expect(label?.classList.contains('comparison__cell--label')).toBe(true);
  });
});
