import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

type Horcher = (ereignis: MediaQueryListEvent) => void;

let horcher: Horcher | null = null;
let systemDunkel = false;

function medienMock(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (abfrage: string) =>
      ({
        matches: systemDunkel,
        media: abfrage,
        addEventListener: (_: string, hoerer: Horcher) => {
          horcher = hoerer;
        },
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

/** Ein frischer Dienst je Test: die Wahl wird beim Bauen gelesen. */
function dienst(): ThemeService {
  TestBed.resetTestingModule();
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    horcher = null;
    systemDunkel = false;
    medienMock();
    document.documentElement.removeAttribute('data-theme');
  });

  it('folgt beim Start dem System', () => {
    systemDunkel = true;
    const theme = dienst();

    theme.init();

    expect(theme.wahl()).toBe('system');
    expect(theme.wirksam()).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('nimmt eine feste Wahl an und merkt sie sich', () => {
    const theme = dienst();
    theme.init();

    theme.setWahl('dunkel');

    expect(theme.wirksam()).toBe('dunkel');
    expect(localStorage.getItem('pilzkarte.theme')).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('reagiert unter „System“ auf einen Wechsel des Betriebssystems', () => {
    const theme = dienst();
    theme.init();

    horcher?.({ matches: true } as MediaQueryListEvent);

    expect(theme.wirksam()).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('lässt eine feste Wahl vom System unberührt', () => {
    const theme = dienst();
    theme.init();
    theme.setWahl('hell');

    horcher?.({ matches: true } as MediaQueryListEvent);

    expect(theme.wirksam()).toBe('hell');
  });

  it('nimmt die gespeicherte Wahl beim Start', () => {
    localStorage.setItem('pilzkarte.theme', 'dunkel');

    expect(dienst().wahl()).toBe('dunkel');
  });

  it('kommt ohne Speicher aus', () => {
    const lesen = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const schreiben = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });

    const theme = dienst();
    theme.setWahl('hell');

    expect(theme.wahl()).toBe('hell');
    lesen.mockRestore();
    schreiben.mockRestore();
  });
});
