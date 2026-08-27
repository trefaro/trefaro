import { Route } from '@angular/router';

/**
 * Routes of the participant client.
 *
 * The start page, a series and an event landing page are all reachable without
 * a login — the low entry barrier the thesis asks for. So are the two pages a
 * mailed link opens: confirming a registration (E5b) and "my registration"
 * (E11), both authorized by a signed token rather than by a session. The
 * participant login of phase 3 goes in front of the second one and leaves the
 * links already in people's inboxes working.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/start/start-page').then((m) => m.StartPage),
    title: 'Trefaro',
  },
  {
    // Before the landing page, for the same reason the landing page comes
    // before `series/:slug`: the longer path has to be matched first.
    path: 'series/:seriesSlug/events/:eventSlug/register',
    loadComponent: () =>
      import('./pages/event-registration/event-registration-page').then(
        (m) => m.EventRegistrationPage,
      ),
    title: 'Register',
  },
  {
    // The confirmation link in the double opt-in mail points here; the token
    // arrives as a query parameter and is bound to the page's input (E5b).
    path: 'registrations/confirm',
    loadComponent: () =>
      import('./pages/registration-confirm/registration-confirm-page').then(
        (m) => m.RegistrationConfirmPage,
      ),
    title: 'Confirm registration',
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
    title: 'My registration',
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
    title: 'Architecture spikes',
  },
  { path: '**', redirectTo: '' },
];
