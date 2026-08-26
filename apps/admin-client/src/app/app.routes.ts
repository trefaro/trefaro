import { Route } from '@angular/router';

/**
 * Routes of the organizer client.
 *
 * Everything here will sit behind the administrative login (UC 01), which
 * arrives with phase 1.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/dashboard/dashboard-page').then((m) => m.DashboardPage),
    title: 'Trefaro Admin',
  },
  {
    path: 'modules',
    loadComponent: () =>
      import('./pages/modules/modules-page').then((m) => m.ModulesPage),
    title: 'Modules',
  },
  { path: '**', redirectTo: '' },
];
