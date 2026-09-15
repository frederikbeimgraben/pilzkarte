import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { BuildingBlocksComponent } from './building-blocks.component';

/** jsdom kennt keinen IntersectionObserver. `app-infinite-list` braucht ihn. */
class ObserverStub {
  observe(): void {
    // Der Fühler bleibt in diesem Test ungenutzt.
  }

  unobserve(): void {
    // Der Stummel braucht keine Buchführung über das Ziel.
  }

  disconnect(): void {
    // Der Stummel räumt nichts auf.
  }
}

/** Die Karten des Boards, in seiner Reihenfolge. */
const CARDS = 67;

describe('BuildingBlocksComponent', () => {
  const providers = [provideRouter([]), provideHttpClient(), provideHttpClientTesting()];

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:eins', revokeObjectURL: () => undefined });
  });

  it('zeigt jede Karte des Boards genau einmal', async () => {
    const { container } = await render(BuildingBlocksComponent, { providers });

    expect(container.querySelectorAll('.block')).toHaveLength(CARDS);
    const heads = [...container.querySelectorAll('.block__head')].map((head) => head.textContent.trim());
    expect(heads[0]).toContain('app-button');
    expect(heads[CARDS - 1]).toContain('app-button busy');
    expect(new Set(heads).size).toBe(CARDS);
  });

  it('stellt die Seite auf das dunkle Thema und gibt es beim Verlassen zurück', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { fixture } = await render(BuildingBlocksComponent, { providers });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fixture.destroy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('bleibt frei von Verstößen gegen die Barrierefreiheit', async () => {
    const { container } = await render(BuildingBlocksComponent, { providers });

    // Die Seite zeigt manchen Baustein mehrfach. Eine Landmarke steht darum
    // doppelt, was nur hier gilt und keine Seite der App betrifft.
    await noViolations(container, ['landmark-unique']);
  }, 90_000);
});
