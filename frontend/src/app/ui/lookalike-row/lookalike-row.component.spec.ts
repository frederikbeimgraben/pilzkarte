import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { LookalikeRowComponent } from './lookalike-row.component';

@Component({
  imports: [LookalikeRowComponent],
  template: `
    <app-lookalike-row
      name="Ölbaumtrichterling"
      latin="Omphalotus olearius"
      route="/arten/oelbaumtrichterling"
      compareRoute="/arten/pfifferling/vergleich/oelbaumtrichterling"
      coloursLabel="Orange"
      [colours]="colours"
    >
      <span>Giftig</span>
    </app-lookalike-row>
    <app-lookalike-row name="Sommersteinpilz" />
  `,
})
class HostComponent {
  readonly colours = [{ name: 'Orange', hex: '#e08a3c' }];
}

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('LookalikeRowComponent', () => {
  it('zeigt Name, lateinischen Namen und Marke', async () => {
    const { container } = await render(HostComponent, { providers: [provideRouter([])] });

    expect(screen.getByText('Ölbaumtrichterling')).toBeInTheDocument();
    expect(screen.getByText('Omphalotus olearius')).toBeInTheDocument();
    expect(screen.getByText('Giftig')).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt über zwei Zeichen zum Vergleich und zur Artseite', async () => {
    await render(HostComponent, { providers: [provideRouter([])] });

    expect(screen.getByRole('link', { name: 'Ölbaumtrichterling gegenüberstellen' })).toHaveAttribute(
      'href',
      '/arten/pfifferling/vergleich/oelbaumtrichterling',
    );
    expect(screen.getByRole('link', { name: 'Ölbaumtrichterling ansehen' })).toHaveAttribute(
      'href',
      '/arten/oelbaumtrichterling',
    );
  });

  it('lässt beide Zeichen weg, wo es kein Ziel gibt', async () => {
    await render(HostComponent, { providers: [provideRouter([])] });

    expect(screen.queryByRole('link', { name: /Sommersteinpilz/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sommersteinpilz')).toBeInTheDocument();
  });

  it('zeigt das Farbfeld des Partners, wo es Farben gibt', async () => {
    const { container } = await render(HostComponent, { providers: [provideRouter([])] });

    // Derselbe Baustein wie auf der Artseite: eine Fläche, kein zweites Muster.
    expect(container.querySelectorAll('app-colour-field')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Orange' })).toBeInTheDocument();
  });

  it('stellt die Marke unter den Text, nicht in den Fluss', async () => {
    const { container } = await render(HostComponent, { providers: [provideRouter([])] });

    // Im Textfluss sprang die Marke je nach Länge in dieselbe oder die nächste
    // Zeile, und der Abstand darüber wechselte von Zeile zu Zeile.
    const value = styleOf(container.querySelector('.lookalike__value'));
    expect(value.flexDirection).toBe('column');
    expect(value.alignItems).toBe('flex-start');
    expect(styleOf(container.querySelector('.lookalike__badge')).marginBlockStart).toBe('var(--space-2)');
  });
});
