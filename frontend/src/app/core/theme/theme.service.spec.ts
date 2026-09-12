import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

type Listener = (event: MediaQueryListEvent) => void;

let listener: Listener | null = null;
let systemDark = false;

function mediaMock(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: systemDark,
        media: query,
        addEventListener: (_: string, handler: Listener) => {
          listener = handler;
        },
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

/** Ein frischer Dienst je Test: die Wahl wird beim Bauen gelesen. */
function service(): ThemeService {
  TestBed.resetTestingModule();
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  beforeEach(() => {
    listener = null;
    systemDark = false;
    mediaMock();
    document.documentElement.removeAttribute('data-theme');
  });

  it('folgt beim Start dem System', () => {
    systemDark = true;
    const theme = service();

    theme.init();

    expect(theme.choice()).toBe('system');
    expect(theme.effective()).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('nimmt eine feste Wahl an und merkt sie sich', () => {
    const theme = service();
    theme.init();

    theme.setChoice('dunkel');

    expect(theme.effective()).toBe('dunkel');
    expect(localStorage.getItem('pilzkarte.theme')).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('reagiert unter „System“ auf einen Wechsel des Betriebssystems', () => {
    const theme = service();
    theme.init();

    listener?.({ matches: true } as MediaQueryListEvent);

    expect(theme.effective()).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('lässt eine feste Wahl vom System unberührt', () => {
    const theme = service();
    theme.init();
    theme.setChoice('hell');

    listener?.({ matches: true } as MediaQueryListEvent);

    expect(theme.effective()).toBe('hell');
  });

  it('nimmt die saved Wahl beim Start', () => {
    localStorage.setItem('pilzkarte.theme', 'dunkel');

    expect(service().choice()).toBe('dunkel');
  });

  it('kommt ohne Speicher aus', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });

    const theme = service();
    theme.setChoice('hell');

    expect(theme.choice()).toBe('hell');
    read.mockRestore();
    write.mockRestore();
  });
});
