import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { keineVerstoesse } from '../../testing/axe';
import { FUND } from '../../testing/eintraege-fixture';
import { FotoGalerieComponent } from './foto-galerie.component';

describe('FotoGalerieComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:foto', revokeObjectURL: () => undefined });
  });

  it('holt jedes Foto über die eigene Route und zeigt es', async () => {
    const { container, detectChanges } = await render(FotoGalerieComponent, {
      inputs: { fundId: FUND.id, fotos: FUND.fotos },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/funde/${FUND.id}/fotos/foto-eins`)
      .flush(new Blob(['bild']));
    await vi.waitFor(() => {
      detectChanges();
      expect(screen.getByRole('img', { name: 'Foto 1' })).toBeInTheDocument();
    });

    await keineVerstoesse(container);
  });

  it('zeigt nichts, wenn ein Foto nicht kommt', async () => {
    const { detectChanges } = await render(FotoGalerieComponent, {
      inputs: { fundId: FUND.id, fotos: FUND.fotos },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/funde/${FUND.id}/fotos/foto-eins`)
      .error(new ProgressEvent('error'));
    await vi.waitFor(() => {
      detectChanges();
    });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('holt gar nichts, wenn ein Fund keine Fotos trägt', async () => {
    await render(FotoGalerieComponent, {
      inputs: { fundId: FUND.id, fotos: [] },
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    TestBed.inject(HttpTestingController).verify();
  });
});
