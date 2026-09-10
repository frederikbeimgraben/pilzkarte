import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { LookalikeRowComponent } from './lookalike-row.component';

@Component({
  imports: [LookalikeRowComponent],
  template: `
    <app-lookalike-row
      name="Ölbaumtrichterling"
      latin="Omphalotus olearius"
      difference="Leuchtet im Dunkeln, Lamellen laufen am Stiel herab, wächst büschelig an Wurzeln."
      route="/arten/oelbaumtrichterling"
    >
      <span>Giftig</span>
    </app-lookalike-row>
    <app-lookalike-row name="Sommersteinpilz" difference="Netz über den ganzen Stiel." />
  `,
})
class WirtComponent {}

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('LookalikeRowComponent', () => {
  it('zeigt Name, lateinischen Namen, Unterschied und Marke', async () => {
    const { container } = await render(WirtComponent, { providers: [provideRouter([])] });

    expect(screen.getByRole('link', { name: 'Ölbaumtrichterling' })).toHaveAttribute(
      'href',
      '/arten/oelbaumtrichterling',
    );
    expect(screen.getByText('Omphalotus olearius')).toBeInTheDocument();
    expect(screen.getByText('Giftig')).toBeInTheDocument();
    await keineVerstoesse(container);
  });

  it('lässt den Namen Text, wenn es kein eigenes Profil gibt', async () => {
    await render(WirtComponent, { providers: [provideRouter([])] });

    expect(screen.queryByRole('link', { name: 'Sommersteinpilz' })).not.toBeInTheDocument();
    expect(screen.getByText('Sommersteinpilz')).toBeInTheDocument();
  });

  it('stellt die Marke unter den Text, nicht in den Fluss', async () => {
    const { container } = await render(WirtComponent, { providers: [provideRouter([])] });

    // Im Textfluss sprang die Marke je nach Länge in dieselbe oder die nächste
    // Zeile, und der Abstand darüber wechselte von Zeile zu Zeile.
    const wert = styleOf(container.querySelector('.verwechslung__wert'));
    expect(wert.flexDirection).toBe('column');
    expect(wert.alignItems).toBe('flex-start');
    expect(styleOf(container.querySelector('.verwechslung__marke')).marginBlockStart).toBe('var(--space-2)');
  });
});
