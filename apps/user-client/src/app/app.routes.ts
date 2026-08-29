import { Route } from '@angular/router';

/**
 * Routes of the participant client.
 *
 * The start page, a series and an event landing page are all reachable without
 * a login — the low entry barrier the thesis asks for. So are the two pages a
 * mailed link opens: confirming a registration (E5b) and "my registration"
 * (E11), both authorized by a signed token rather than by a session. The
 * participant login of phase 3 goes in front of the second one and leaves the
 * links already in people's inboxes working. The third such page is the
 * objection to further invitations (E15), which needs no account by design.
 */
export const appRoutes: Route[] = [
  {
    // No title on purpose: `TrefaroTitleStrategy` then puts the organization's
    // name in the tab on its own. This page *is* the instance, so naming a
    // section of it beside the organization would name the only section there is.
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/start/start-page').then((m) => m.StartPage),
  },
  {
    // Before the landing page, for the same reason the landing page comes
    // before `series/:slug`: the longer path has to be matched first.
    path: 'series/:seriesSlug/events/:eventSlug/register',
    loadComponent: () =>
      import('./pages/event-registration/event-registration-page').then(
        (m) => m.EventRegistrationPage,
      ),
    title: 'register.title',
  },
  {
    // The confirmation link in the double opt-in mail points here; the token
    // arrives as a query parameter and is bound to the page's input (E5b).
    path: 'registrations/confirm',
    loadComponent: () =>
      import('./pages/registration-confirm/registration-confirm-page').then(
        (m) => m.RegistrationConfirmPage,
      ),
    title: 'confirm.title',
  },
  {
    // The personal link in the confirmation receipt points here (E11); the token
    // arrives as a query parameter and is bound to the page's input, exactly as
    // for the confirmation above.
    path: 'registrations/me',
    loadComponent: () =>
      import('./pages/my-registration/my-registration-page').then(
        (m) => m.MyRegistrationPage,
      ),
    title: 'mine.title',
  },
  {
    // The objection link in an invitation points here (E15, F58); the token
    // arrives as a query parameter, exactly as for the two links above. The
    // page objects by POST, so a link previewer decides nothing.
    path: 'invitations/unsubscribe',
    loadComponent: () =>
      import('./pages/invitation-opt-out/invitation-opt-out-page').then(
        (m) => m.InvitationOptOutPage,
      ),
    title: 'optOut.title',
  },
  {
    // Before `series/:slug`, so the more specific route wins rather than
    // relying on the router to backtrack out of a partial match.
    path: 'series/:seriesSlug/events/:eventSlug',
    loadComponent: () =>
      import('./pages/event-landing/event-landing-page').then(
        (m) => m.EventLandingPage,
      ),
  },
  {
    path: 'series/:slug',
    loadComponent: () =>
      import('./pages/series-detail/series-detail-page').then(
        (m) => m.SeriesDetailPage,
      ),
  },
  {
    // Phase 0 diagnostics: makes the architecture spikes verifiable in a browser.
    // Kept out of the navigation; phase 5 decides whether it stays as an
    // operator tool or goes.
    path: 'spikes',
    loadComponent: () =>
      import('./pages/spike-console/spike-console-page').then(
        (m) => m.SpikeConsolePage,
      ),
    title: 'diagnostics.title',
  },
  { path: '**', redirectTo: '' },
];
