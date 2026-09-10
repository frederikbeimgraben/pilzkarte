import { InjectionToken } from '@angular/core';
import type { UserManager, UserManagerSettings } from 'oidc-client-ts';

/** Was der Dienst braucht, um einen `UserManager` zu bekommen. */
export type UserManagerFabrik = (einstellungen: UserManagerSettings) => Promise<UserManager>;

/**
 * `oidc-client-ts` liegt hinter einem dynamischen Import, damit die Bibliothek
 * ein eigener Chunk bleibt und der Start der Karte nichts von ihr weiß.
 *
 * Die beiden Speicher sind die eigentliche Entscheidung:
 *
 * - `userStore` hält Access- und Refresh-Token. Er liegt im Arbeitsspeicher,
 *   damit kein Token einen Reload, `localStorage` oder ein Cookie überlebt.
 *   Der Preis: nach dem Reload holt eine stille Erneuerung die Sitzung zurück.
 * - `stateStore` hält den PKCE-Prüfwert zwischen Hinweg und Rückkehr. Der muss
 *   den Seitenwechsel überstehen, ist aber kein Token; `sessionStorage` endet
 *   mit dem Tab, `localStorage` täte es nicht.
 */
export const USER_MANAGER_FABRIK = new InjectionToken<UserManagerFabrik>('USER_MANAGER_FABRIK', {
  providedIn: 'root',
  factory:
    (): UserManagerFabrik =>
    async (einstellungen): Promise<UserManager> => {
      const { InMemoryWebStorage, UserManager, WebStorageStateStore } = await import('oidc-client-ts');
      return new UserManager({
        ...einstellungen,
        userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
        stateStore: new WebStorageStateStore({ store: sessionStorage }),
      });
    },
});
