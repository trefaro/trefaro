import { Route } from '@angular/router';
import { adminAuthGuard, notLoggedInGuard } from './features/auth/auth.guard';
import { setupPendingGuard } from './features/setup/setup.guard';

/**
 * Routes of the organizer client.
 *
 * Everything except the login sits behind {@link adminAuthGuard}. The guard
 * keeps the workspace from rendering without a session; the server enforces the
 * same boundary on every request regardless (FR 1.3).
 */
export const appRoutes: Route[] = [
  {
    // Only reachable while this instance has no administrator (FR 1.1, E28) —
    // and it is where the session guard sends anybody who arrives before then,
    // because a login form without an account behind it is a dead end.
    path: 'setup',
    canActivate: [setupPendingGuard],
    loadComponent: () =>
      import('./pages/setup/setup-page').then((m) => m.SetupPage),
    title: 'admin.setup.title',
  },
  {
    path: 'login',
    canActivate: [notLoggedInGuard],
    loadComponent: () =>
      import('./pages/login/login-page').then((m) => m.LoginPage),
    title: 'admin.login.title',
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
        title: 'admin.series.title',
      },
      {
        // Before `series/:id`, or "new" would be read as an id.
        path: 'series/new',
        loadComponent: () =>
          import('./pages/series/series-form-page').then(
            (m) => m.SeriesFormPage,
          ),
        title: 'admin.series.new',
      },
      {
        path: 'series/:id/edit',
        loadComponent: () =>
          import('./pages/series/series-form-page').then(
            (m) => m.SeriesFormPage,
          ),
        title: 'admin.series.edit',
      },
      {
        // Before `series/:seriesId/events/:eventId`, or "new" would be an id.
        path: 'series/:seriesId/events/new',
        loadComponent: () =>
          import('./pages/events/event-form-page').then((m) => m.EventFormPage),
        title: 'admin.events.new',
      },
      {
        // Before `series/:seriesId/events/:eventId`, so "edit" is not read as
        // part of the event's own route — the same order the series uses.
        path: 'series/:seriesId/events/:eventId/edit',
        loadComponent: () =>
          import('./pages/events/event-form-page').then((m) => m.EventFormPage),
        title: 'admin.events.edit',
      },
      {
        // Before `series/:seriesId/events/:eventId`, so "participants" is not
        // read as part of the event's own route.
        path: 'series/:seriesId/events/:eventId/participants',
        loadComponent: () =>
          import('./pages/participants/participants-page').then(
            (m) => m.ParticipantsPage,
          ),
        title: 'admin.participants.title',
      },
      {
        // Before `series/:seriesId/events/:eventId`, same reason again.
        path: 'series/:seriesId/events/:eventId/translations',
        loadComponent: () =>
          import('./pages/translations/event-translations-page').then(
            (m) => m.EventTranslationsPage,
          ),
        title: 'admin.translations.title',
      },
      {
        // Before `series/:seriesId/events/:eventId` for the same reason as the
        // participants route above.
        path: 'series/:seriesId/events/:eventId/program',
        loadComponent: () =>
          import('./pages/program/program-page').then((m) => m.ProgramPage),
        title: 'admin.program.title',
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
        title: 'modules.mediaLinks.title',
      },
      {
        // Same reason again.
        path: 'series/:seriesId/events/:eventId/registration-form',
        loadComponent: () =>
          import('./pages/registration-fields/registration-fields-page').then(
            (m) => m.RegistrationFieldsPage,
          ),
        title: 'admin.fields.title',
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
        title: 'admin.dashboard.title',
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
        title: 'admin.invitations.title',
      },
      {
        // Before `series/:id`, so "translations" is not read as an id — the same
        // order every other sub-page of a series uses. The parameter is `id`
        // because `withComponentInputBinding()` binds by name.
        path: 'series/:id/translations',
        loadComponent: () =>
          import('./pages/translations/series-translations-page').then(
            (m) => m.SeriesTranslationsPage,
          ),
        title: 'admin.translations.title',
      },
      {
        path: 'series/:id',
        loadComponent: () =>
          import('./pages/series/series-detail-page').then(
            (m) => m.SeriesDetailPage,
          ),
        title: 'admin.series.title',
      },
      {
        // Before `messages/:id`, and the overview of everything the
        // organization is part of (FR 3.4). Not nested under an event,
        // although a conversation names one: an organizer opens their
        // messages, not one event's.
        path: 'messages',
        loadComponent: () =>
          import('./pages/messages/messages-page').then((m) => m.MessagesPage),
        title: 'admin.messages.title',
      },
      {
        // The parameter is `id` because `withComponentInputBinding()` binds by
        // name, and that is what the page's input is called.
        path: 'messages/:id',
        loadComponent: () =>
          import('./pages/messages/conversation-page').then(
            (m) => m.AdminConversationPage,
          ),
        title: 'admin.messages.title',
      },
      {
        path: 'administrators',
        loadComponent: () =>
          import('./pages/admins/admins-page').then((m) => m.AdminsPage),
        title: 'admin.admins.title',
      },
      {
        path: 'design',
        loadComponent: () =>
          import('./pages/design/design-page').then((m) => m.DesignPage),
        title: 'admin.design.title',
      },
      {
        path: 'modules',
        loadComponent: () =>
          import('./pages/modules/modules-page').then((m) => m.ModulesPage),
        title: 'admin.modules.title',
      },
      {
        // Instance-wide and therefore without a parent in the path, unlike an
        // event's registration form (F122): a profile belongs to a person.
        path: 'profile-form',
        loadComponent: () =>
          import('./pages/profile-fields/profile-fields-page').then(
            (m) => m.ProfileFieldsPage,
          ),
        title: 'admin.profileFields.title',
      },
      {
        path: 'languages',
        loadComponent: () =>
          import('./pages/languages/languages-page').then(
            (m) => m.LanguagesPage,
          ),
        title: 'admin.languages.title',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
