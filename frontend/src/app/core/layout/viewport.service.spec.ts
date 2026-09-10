import { TestBed } from '@angular/core/testing';
import { ViewportService, COLUMN_FROM } from './viewport.service';

describe('AnsichtDienst', () => {
  it('folgt der Breite des Fensters', () => {
    const reported: ((event: MediaQueryListEvent) => void)[] = [];
    vi.stubGlobal('matchMedia', (medium: string) => ({
      matches: false,
      media: medium,
      addEventListener: (_kind: string, handler: (event: MediaQueryListEvent) => void) => {
        reported.push(handler);
      },
      removeEventListener: () => undefined,
    }));
    const service = TestBed.inject(ViewportService);

    expect(service.wide()).toBe(false);

    reported[0]({ matches: true } as MediaQueryListEvent);

    expect(service.wide()).toBe(true);
    expect(COLUMN_FROM).toBe(1024);
  });
});
