import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Species } from '../../core/api/models';
import { GALLENROEHRLING, STEINPILZ } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { ComparisonComponent } from './comparison.component';

@Component({ template: '' })
class OtherComponent {}

const ROUTES = [{ path: 'arten/:slug', component: OtherComponent }];

interface Setup {
  container: Element;
  router: Router;
  refresh: () => void;
}

async function build(arten: readonly (Species | 'fehlt')[] = [STEINPILZ, GALLENROEHRLING]): Promise<Setup> {
  const slugs = ['steinpilz', 'gallenroehrling'];
  const { container, detectChanges } = await render(ComparisonComponent, {
    inputs: { slug: slugs[0], andere: slugs[1] },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ROUTES)],
  });
  const http = TestBed.inject(HttpTestingController);
  slugs.forEach((slug, index) => {
    const request = http.expectOne(`/api/arten/${slug}`);
    const art = arten[index];
    if (art === 'fehlt') {
      request.flush(
        { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    } else {
      request.flush(art);
    }
  });
  detectChanges();
  return { container, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('ComparisonComponent', () => {
  it('stellt beide Arten mit ihren Merkmalen nebeneinander', async () => {
    const setup = await build();

    const table = screen.getByRole('table', {
      name: 'Merkmale von Steinpilz, Gallenröhrling nebeneinander',
    });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((head) => head.textContent),
    ).toEqual(['Merkmal', 'Steinpilz', 'Gallenröhrling']);
    await noViolations(setup.container);
  });

  it('nennt die Zeilen in der Reihenfolge der Artseite', async () => {
    const setup = await build();

    const labels = [...setup.container.querySelectorAll('app-comparison-row')].map((row) =>
      row.querySelector('app-comparison-cell')?.textContent.trim(),
    );
    expect(labels).toEqual([
      'Speisewert',
      'Hut',
      'Hut',
      'Sporenlager',
      'Auf Druck oder im Schnitt',
      'Stiel',
      'Geschmack',
      'Wachstum',
    ]);
  });

  it('tönt genau die Zeilen, in denen sich die Arten unterscheiden', async () => {
    const setup = await build();

    const rows = [...setup.container.querySelectorAll('app-comparison-row')];
    const tinted = rows
      .filter((row) => row.classList.contains('comparison__row--differs'))
      .map((row) => row.querySelector('app-comparison-cell')?.textContent.trim());
    // Der Gallenröhrling der Fixture erbt vom Steinpilz und trennt sich nur im
    // Speisewert. Genau diese Zeile ist getönt, keine andere.
    expect(tinted).toEqual(['Speisewert']);
  });

  it('zeigt jede Zelle mit dem Baustein ihres Merkmals', async () => {
    const setup = await build();

    expect(setup.container.querySelectorAll('app-level-pill')).toHaveLength(2);
    expect(setup.container.querySelectorAll('app-measurement')).toHaveLength(2);
    expect(setup.container.querySelectorAll('app-colour-field').length).toBeGreaterThanOrEqual(4);
    expect(setup.container.querySelectorAll('app-tag-list')).toHaveLength(2);
    expect(setup.container.querySelectorAll('app-year-band')).toHaveLength(2);
  });

  it('verträgt mehr als einen Wert in einer Zelle', async () => {
    const setup = await build();

    // Die Hutform bringt später zwei Werte je Zelle, jung und alt. Die Zelle
    // bricht sie um, statt sie in eine Zeile zu quetschen.
    const cells = setup.container.querySelectorAll('app-comparison-cell');
    expect(getComputedStyle(cells[0]).flexWrap).toBe('wrap');
  });

  it('führt zurück zur Art, von der der Vergleich kam', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    await vi.waitFor(() => {
      expect(setup.router.url).toBe('/arten/steinpilz');
    });
  });

  it('sagt es, wenn eine der beiden Arten fehlt', async () => {
    await build([STEINPILZ, 'fehlt']);

    expect(screen.getByText('Eine der beiden Arten gibt es nicht.')).toBeInTheDocument();
  });
});
