import { isDevMode } from '@angular/core';
import type { Routes } from '@angular/router';
import { requiresPermission } from './features/admin/admin.guard';

/**
 * Die vier Reiter. Wo das Arbeitspaket noch aussteht, steht ein Platzhalter.
 * Die Baustein-Seite gibt es nur in der Entwicklung, sonst läge eine
 * Werkstattseite im Betrieb.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'karte' },
  {
    path: 'karte',
    loadComponent: () => import('./features/map/map-route.component').then((m) => m.MapRouteComponent),
  },
  {
    path: 'arten',
    loadComponent: () =>
      import('./features/species/species-list.component').then((m) => m.SpeciesListComponent),
  },
  {
    path: 'arten/:slug',
    loadComponent: () => import('./features/species/species.component').then((m) => m.SpeciesComponent),
  },
  {
    path: 'arten/:slug/bild',
    loadComponent: () =>
      import('./features/species/submit-image.component').then((m) => m.SubmitImageComponent),
  },
  {
    path: 'eintraege',
    loadComponent: () => import('./features/entries/entries.component').then((m) => m.EntriesComponent),
  },
  {
    path: 'konto',
    loadComponent: () => import('./features/account/account.component').then((m) => m.AccountComponent),
  },
  {
    path: 'konto/bilder',
    loadComponent: () => import('./features/account/my-images.component').then((m) => m.MyImagesComponent),
  },
  {
    path: 'verwaltung',
    canActivate: [requiresPermission(null)],
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
    children: [
      {
        path: 'texte',
        canActivate: [requiresPermission('text.edit')],
        loadComponent: () => import('./features/admin/texts.component').then((m) => m.TextsComponent),
      },
      {
        path: 'rollen',
        canActivate: [requiresPermission('role.manage')],
        loadComponent: () => import('./features/admin/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'rollen/:id',
        canActivate: [requiresPermission('role.manage')],
        loadComponent: () => import('./features/admin/role.component').then((m) => m.RoleComponent),
      },
      {
        path: 'bilder',
        canActivate: [requiresPermission('image.review')],
        loadComponent: () => import('./features/admin/images.component').then((m) => m.AdminImagesComponent),
      },
      {
        path: 'personen',
        canActivate: [requiresPermission('role.assign')],
        loadComponent: () => import('./features/admin/people.component').then((m) => m.PeopleComponent),
      },
    ],
  },
  // Die stille Route steht vor der Anmeldung: sonst nähme diese den ersten
  // Abschnitt und der Rest des Weges fände keine Route mehr.
  {
    path: 'anmeldung/still',
    loadComponent: () =>
      import('./features/account/silent-signin.component').then((m) => m.SilentSignInComponent),
  },
  {
    path: 'anmeldung',
    loadComponent: () =>
      import('./features/account/signin-callback.component').then((m) => m.SignInCallbackComponent),
  },
  ...(isDevMode()
    ? [
        {
          path: 'bausteine',
          loadComponent: () =>
            import('./dev/building-blocks/building-blocks.component').then((m) => m.BuildingBlocksComponent),
        },
      ]
    : []),
  { path: '**', redirectTo: 'karte' },
];
