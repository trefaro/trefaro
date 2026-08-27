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
          import('./pages/series/series-list-page').then(
            (m) => m.SeriesListPage,
          ),
        title: 'Event series — Trefaro',
      },
      {
        // Before `series/:id`, or "new" would be read as an id.
        path: 'series/new',
        loadComponent: () =>
          import('./pages/series/series-form-page').then(
            (m) => m.SeriesFormPage,
          ),
        title: 'New event series — Trefaro',
      },
      {
        path: 'series/:id/edit',
        loadComponent: () =>
          import('./pages/series/series-form-page').then(
            (m) => m.SeriesFormPage,
          ),
        title: 'Edit event series — Trefaro',
      },
      {
        // Before `series/:seriesId/events/:eventId`, or "new" would be an id.
        path: 'series/:seriesId/events/new',
        loadComponent: () =>
          import('./pages/events/event-form-page').then((m) => m.EventFormPage),
        title: 'New event — Trefaro',
      },
      {
        // Before `series/:seriesId/events/:eventId`, so "participants" is not
        // read as part of the event's own route.
        path: 'series/:seriesId/events/:eventId/participants',
        loadComponent: () =>
          import('./pages/participants/participants-page').then(
            (m) => m.ParticipantsPage,
          ),
        title: 'Participants — Trefaro',
      },
      {
        path: 'series/:seriesId/events/:eventId',
        loadComponent: () =>
          import('./pages/events/event-form-page').then((m) => m.EventFormPage),
        title: 'Event — Trefaro',
      },
      {
        path: 'series/:id',
        loadComponent: () =>
          import('./pages/series/series-detail-page').then(
            (m) => m.SeriesDetailPage,
          ),
        title: 'Event series — Trefaro',
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
