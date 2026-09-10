import { TestBed } from '@angular/core/testing';
import { ToastService } from '@stupa-makers/ui-kit';

/** Was die Oberfläche gemeldet hat, ohne dass ein Toast im Bild stehen muss. */
export interface ToastSpy {
  failure: string[];
  success: string[];
}

/**
 * Fängt die Meldungen des Kits ab. Der Toast-Behälter steht in der Hülle; ein
 * Test einer einzelnen Komponente hat ihn nicht, und die Meldung ginge sonst
 * ins Leere.
 */
export function toastSpy(): ToastSpy {
  const service = TestBed.inject(ToastService);
  const spy: ToastSpy = { failure: [], success: [] };
  vi.spyOn(service, 'error').mockImplementation((text: string) => {
    spy.failure.push(text);
    return 0;
  });
  vi.spyOn(service, 'success').mockImplementation((text: string) => {
    spy.success.push(text);
    return 0;
  });
  return spy;
}
