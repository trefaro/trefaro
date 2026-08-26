import { Route } from '@angular/router';
import { adminAuthGuard, notLoggedInGuard } from './features/auth/auth.guard';

/**
 * Routes of the organizer client.
 *
 * Everything except the login sits behind {@link adminAuthGuard}. The guard
 * keeps the workspace from rendering without a session; the server enforces the
 * same boundary on every request regardless (FR 1.3).
 */
export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [notLoggedInGuard],
    loadComponent: () =>
      import('./pages/login/login-page').then((m) => m.LoginPage),
    title: 'Sign in — Trefaro',
  },
  {
    path: '',
    canActivate: [adminAuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-page').then(
            (m) => m.DashboardPage,
          ),
        title: 'Trefaro Admin',
      },
      {
        path: 'administrators',
        loadComponent: () =>
          import('./pages/admins/admins-page').then((m) => m.AdminsPage),
        title: 'Administrators',
      },
      {
        path: 'modules',
        loadComponent: () =>
          import('./pages/modules/modules-page').then((m) => m.ModulesPage),
        title: 'Modules',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
