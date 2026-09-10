import { TestBed } from '@angular/core/testing';
import { ToastService } from '@stupa-makers/ui-kit';

/** Was die Oberfläche gemeldet hat, ohne dass ein Toast im Bild stehen muss. */
export interface ToastSpion {
  fehler: string[];
  erfolg: string[];
}

/**
 * Fängt die Meldungen des Kits ab. Der Toast-Behälter steht in der Hülle; ein
 * Test einer einzelnen Komponente hat ihn nicht, und die Meldung ginge sonst
 * ins Leere.
 */
export function toastSpion(): ToastSpion {
  const dienst = TestBed.inject(ToastService);
  const spion: ToastSpion = { fehler: [], erfolg: [] };
  vi.spyOn(dienst, 'error').mockImplementation((text: string) => {
    spion.fehler.push(text);
    return 0;
  });
  vi.spyOn(dienst, 'success').mockImplementation((text: string) => {
    spion.erfolg.push(text);
    return 0;
  });
  return spion;
}
