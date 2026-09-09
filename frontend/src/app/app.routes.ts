import { isDevMode } from '@angular/core';
import type { Routes } from '@angular/router';

/**
 * Die vier Reiter stehen als Platzhalter, damit die Struktur schon trägt; die
 * Inhalte kommen in A2 und später. Die Baustein-Seite gibt es nur in der
 * Entwicklung, sonst läge eine Werkstattseite im Betrieb.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'karte' },
  {
    path: 'karte',
    loadComponent: () => import('./features/karte/karte.component').then((m) => m.KarteComponent),
  },
  {
    path: 'arten',
    loadComponent: () => import('./features/arten/arten.component').then((m) => m.ArtenComponent),
  },
  {
    path: 'eintraege',
    loadComponent: () => import('./features/eintraege/eintraege.component').then((m) => m.EintraegeComponent),
  },
  {
    path: 'konto',
    loadComponent: () => import('./features/konto/konto.component').then((m) => m.KontoComponent),
  },
  ...(isDevMode()
    ? [
        {
          path: 'bausteine',
          loadComponent: () =>
            import('./dev/bausteine/bausteine.component').then((m) => m.BausteineComponent),
        },
      ]
    : []),
  { path: '**', redirectTo: 'karte' },
];
