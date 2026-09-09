import { TestBed } from '@angular/core/testing';
import { AnsichtDienst, SPALTE_AB } from './ansicht.service';

describe('AnsichtDienst', () => {
  it('folgt der Breite des Fensters', () => {
    const gemeldet: ((ereignis: MediaQueryListEvent) => void)[] = [];
    vi.stubGlobal('matchMedia', (medium: string) => ({
      matches: false,
      media: medium,
      addEventListener: (_typ: string, hoerer: (ereignis: MediaQueryListEvent) => void) => {
        gemeldet.push(hoerer);
      },
      removeEventListener: () => undefined,
    }));
    const dienst = TestBed.inject(AnsichtDienst);

    expect(dienst.breit()).toBe(false);

    gemeldet[0]({ matches: true } as MediaQueryListEvent);

    expect(dienst.breit()).toBe(true);
    expect(SPALTE_AB).toBe(1024);
  });
});
