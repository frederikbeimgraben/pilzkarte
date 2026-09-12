import type { Routes } from '@angular/router';

/**
 * Eine Route, die jede Adresse annimmt. Ein Test prüft, wohin eine Seite
 * führt, nicht was dort steht; ohne diese Route bräche jede Navigation ab.
 */
export const ANY_ROUTE: Routes = [{ path: '**', children: [] }];
