import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Taxon } from '../../core/api/models';
import { AGARICOMYCETES, BOLETACEAE, BOLETUS } from '../../testing/taxonomy-fixture';
import { noViolations } from '../../testing/axe';
import { TaxonomyComponent } from './taxonomy.component';

interface Setup {
  container: Element;
  router: Router;
}

async function build(taxon: Taxon | 'fehlt', rank = 'gattung', slug = 'boletus'): Promise<Setup> {
  const { container, detectChanges } = await render(TaxonomyComponent, {
    inputs: { rank, slug },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const http = TestBed.inject(HttpTestingController);
  const request = http.expectOne(`/api/taxonomie/${rank}/${slug}`);
  if (taxon === 'fehlt') {
    request.flush(
      { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
  } else {
    request.flush(taxon);
  }
  detectChanges();
  return { container, router: TestBed.inject(Router) };
}

describe('TaxonomyComponent', () => {
  it('zeigt den Weg nach oben, die Nachbarn und die Arten einer Gattung', async () => {
    const { container } = await build(BOLETUS);

    expect(screen.getByRole('heading', { level: 1, name: 'Boletus' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Röhrlinge' }).getAttribute('href')).toBe(
      '/taxonomie/ordnung/boletales',
    );
    expect(screen.getByRole('link', { name: 'Boletaceae' }).getAttribute('href')).toBe(
      '/taxonomie/familie/boletaceae',
    );
    expect(screen.getByRole('button', { name: /Imleria/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Steinpilz/ })).toBeTruthy();
    await noViolations(container);
  }, 30_000);

  it('nennt den Rang und die Zahl der Arten darunter', async () => {
    await build(BOLETUS);

    expect(screen.getByText('Gattung')).toBeTruthy();
    expect(screen.getByText('1 Arten im Katalog')).toBeTruthy();
  });

  it('zählt die Arten an jeder untergeordneten Stufe', async () => {
    await build(BOLETACEAE, 'familie', 'boletaceae');

    const boletus = screen.getByRole('button', { name: /Boletus/ });

    expect(boletus.textContent).toContain('1 Arten im Katalog');
    expect(screen.getByText('Keine Art hängt unmittelbar hier, nur an den Stufen darunter.')).toBeTruthy();
  });

  it('sagt an der Wurzel, dass es darüber nichts gibt', async () => {
    await build(AGARICOMYCETES, 'klasse', 'agaricomycetes');

    expect(screen.getByText('Diese Stufe ist die oberste im Katalog.')).toBeTruthy();
    expect(screen.getByText('Keine weitere Stufe daneben.')).toBeTruthy();
  });

  it('springt auf eine untergeordnete Stufe', async () => {
    const { router } = await build(BOLETACEAE, 'familie', 'boletaceae');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: /Boletus/ }));

    expect(navigate).toHaveBeenCalledWith('/taxonomie/gattung/boletus');
  });

  it('springt von einer Art auf ihr Profil', async () => {
    const { router } = await build(BOLETUS);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    expect(navigate).toHaveBeenCalledWith(['/arten', 'steinpilz']);
  });

  it('meldet eine Stufe, die es nicht gibt', async () => {
    await build('fehlt');

    expect(screen.getByText('Diese Stufe steht nicht in der Einordnung.')).toBeTruthy();
  });

  it('fragt einen Rang gar nicht erst, den der Vertrag nicht kennt', async () => {
    const { detectChanges } = await render(TaxonomyComponent, {
      inputs: { rank: 'reich', slug: 'fungi' },
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    detectChanges();

    TestBed.inject(HttpTestingController).verify();
    expect(screen.getByText('Diese Stufe steht nicht in der Einordnung.')).toBeTruthy();
  });
});
