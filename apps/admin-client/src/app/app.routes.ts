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
        // Before `series/:seriesId/events/:eventId`, so "edit" is not read as
        // part of the event's own route — the same order the series uses.
        path: 'series/:seriesId/events/:eventId/edit',
        loadComponent: () =>
          import('./pages/events/event-form-page').then((m) => m.EventFormPage),
        title: 'Edit event — Trefaro',
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
        // Before `series/:seriesId/events/:eventId` for the same reason as the
        // participants route above.
        path: 'series/:seriesId/events/:eventId/program',
        loadComponent: () =>
          import('./pages/program/program-page').then((m) => m.ProgramPage),
        title: 'Programme — Trefaro',
      },
      {
        // Same reason again. The page says so itself when the module is switched
        // off (FR 1.5), rather than being routed away — the address may sit in
        // somebody's bookmarks.
        path: 'series/:seriesId/events/:eventId/media-links',
        loadComponent: () =>
          import('./pages/media-links/media-links-page').then(
            (m) => m.MediaLinksPage,
          ),
        title: 'Media links — Trefaro',
      },
      {
        // Same reason again.
        path: 'series/:seriesId/events/:eventId/registration-form',
        loadComponent: () =>
          import('./pages/registration-fields/registration-fields-page').then(
            (m) => m.RegistrationFieldsPage,
          ),
        title: 'Registration form — Trefaro',
      },
      {
        // The event's home: its numbers, and the way to everything below it
        // (FR 3.8). The form it used to be sits at `/edit` now, exactly as a
        // series' detail page and its form do.
        path: 'series/:seriesId/events/:eventId',
        loadComponent: () =>
          import('./pages/event-dashboard/event-dashboard-page').then(
            (m) => m.EventDashboardPage,
          ),
        title: 'Event — Trefaro',
      },
      {
        // Before `series/:id`, so "invitations" is not read as an id — the same
        // order the event's own sub-pages use. The parameter is `seriesId`
        // because `withComponentInputBinding()` binds by name, and that is what
        // the page's input is called.
        path: 'series/:seriesId/invitations',
        loadComponent: () =>
          import('./pages/invitations/invitations-page').then(
            (m) => m.InvitationsPage,
          ),
        title: 'Invite former participants — Trefaro',
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
        path: 'design',
        loadComponent: () =>
          import('./pages/design/design-page').then((m) => m.DesignPage),
        title: 'Design',
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
