import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SPECIES_LIST } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { SpeciesPickerComponent } from './species-picker.component';

async function build(selected: string | null = null): Promise<{ container: Element; matches: string[] }> {
  const { container, detectChanges, fixture } = await render(SpeciesPickerComponent, {
    inputs: { selected },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/arten').flush(SPECIES_LIST);
  detectChanges();
  const matches: string[] = [];
  fixture.componentInstance.chosen.subscribe((art) => matches.push(art.slug));
  return { container, matches };
}

describe('ArtWahlComponent', () => {
  it('zeigt den Katalog und meldet die gewählte Art', async () => {
    const { container, matches } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    expect(matches).toEqual(['steinpilz']);
    await noViolations(container);
  });

  it('kennzeichnet die schon gewählte Art', async () => {
    await build('steinpilz');

    expect(screen.getByRole('button', { name: /Steinpilz.*gewählt/ })).toBeInTheDocument();
  });

  it('sucht nach Name und lateinischem Namen', async () => {
    await build();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Imleria');

    expect(screen.getByRole('button', { name: /Maronenröhrling/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Steinpilz/ })).not.toBeInTheDocument();
  });

  it('sagt es, wenn nichts passt', async () => {
    await build();

    await userEvent.type(screen.getByLabelText('Art suchen'), 'Trüffel');

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
  });
});
