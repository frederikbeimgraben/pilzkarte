import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ARTEN_LISTE } from '../../testing/arten-fixture';
import { keineVerstoesse } from '../../testing/axe';
import { ArtWahlComponent } from './art-wahl.component';

async function aufbauen(gewaehlt: string | null = null): Promise<{ container: Element; treffer: string[] }> {
  const { container, detectChanges, fixture } = await render(ArtWahlComponent, {
    inputs: { gewaehlt },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(ARTEN_LISTE);
  detectChanges();
  const treffer: string[] = [];
  fixture.componentInstance.auswahl.subscribe((art) => treffer.push(art.slug));
  return { container, treffer };
}

describe('ArtWahlComponent', () => {
  it('zeigt den Katalog und meldet die gewählte Art', async () => {
    const { container, treffer } = await aufbauen();

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    expect(treffer).toEqual(['steinpilz']);
    await keineVerstoesse(container);
  });

  it('kennzeichnet die schon gewählte Art', async () => {
    await aufbauen('steinpilz');

    expect(screen.getByRole('button', { name: /Steinpilz.*gewählt/ })).toBeInTheDocument();
  });

  it('sucht nach Name und lateinischem Namen', async () => {
    await aufbauen();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Imleria');

    expect(screen.getByRole('button', { name: /Maronenröhrling/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Steinpilz/ })).not.toBeInTheDocument();
  });

  it('sagt es, wenn nichts passt', async () => {
    await aufbauen();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Trüffel');

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
  });
});
