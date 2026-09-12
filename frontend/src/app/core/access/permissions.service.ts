import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccessApi } from '../api/access.api';
import type { Permission } from '../api/models';
import { AuthService } from '../auth';

/**
 * Die eigenen Rechte als Signal.
 *
 * Sie kommen einmal je Anmeldung von `/api/me/permissions` und blenden in der
 * Oberfläche Punkte und Knöpfe aus. Entschieden wird damit nichts: jede Route
 * des Servers prüft ihr Recht selbst. Wer hier lügt, bekommt vom Dienst ein
 * 403 statt einer Wirkung.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly api = inject(AccessApi);
  private readonly auth = inject(AuthService);

  private readonly held = signal<readonly Permission[] | null>(null);

  /** `null`, solange die Antwort aussteht. Dann zeigt die Oberfläche nichts. */
  readonly permissions = this.held.asReadonly();
  /**
   * Ob feststeht, was die Person darf. Beim Start läuft die stille Anmeldung
   * noch; solange sie läuft, ist „nicht angemeldet“ keine Antwort.
   */
  readonly settled = computed(() => this.held() !== null || (!this.auth.signedIn() && !this.auth.busy()));

  constructor() {
    effect(() => {
      // Ohne Anmeldung antwortet der Endpunkt mit 401. Die Abmeldung räumt die
      // Rechte weg, sonst bliebe die Verwaltung nach dem Abmelden sichtbar.
      if (this.auth.signedIn()) this.load();
      else this.held.set(null);
    });
  }

  can(permission: Permission): boolean {
    return this.held()?.includes(permission) ?? false;
  }

  /** Ob die Person überhaupt einen Punkt der Verwaltung sieht. */
  canAny(permissions: readonly Permission[]): boolean {
    return permissions.some((permission) => this.can(permission));
  }

  private load(): void {
    this.api.mine().subscribe({
      next: (answer) => {
        this.held.set(answer.permissions);
      },
      // Ein Ausfall lässt die Rechte leer: lieber ein fehlender Punkt als ein
      // Knopf, der ins 403 läuft. Der Toast des ApiClient sagt schon Bescheid.
      error: () => {
        this.held.set([]);
      },
    });
  }
}
