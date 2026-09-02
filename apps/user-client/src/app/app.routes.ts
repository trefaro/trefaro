import { Route } from '@angular/router';
import {
  participantAnonymousGuard,
  participantSessionGuard,
} from './features/auth/participant-session.guard';

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
 *
 * The four `profile/*` routes are the account itself (FR 4.1–4.3). Three of
 * them are for somebody who is *not* logged in — registering, confirming,
 * logging in — and only `profile` needs a session. Two of the four are linked
 * from a mail, so their addresses are constants in `shared-models` that the
 * server reads as well: `PROFILE_CONFIRMATION_PATH` and `PROFILE_LOGIN_PATH`.
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
    // Before `profile`, like every longer path in this file. The account
    // confirmation mail links here (E5b) — the address is `PROFILE_LOGIN_PATH`'s
    // neighbour in `shared-models`, so the mail and the route cannot drift.
    path: 'profile/confirm',
    loadComponent: () =>
      import('./pages/profile-confirm/profile-confirm-page').then(
        (m) => m.ProfileConfirmPage,
      ),
    title: 'profile.confirm.title',
  },
  {
    // Also linked from a mail: the message somebody gets when they try to
    // register an address that already has an account points here (E32).
    path: 'profile/login',
    canActivate: [participantAnonymousGuard],
    loadComponent: () =>
      import('./pages/profile-login/profile-login-page').then(
        (m) => m.ProfileLoginPage,
      ),
    title: 'profile.login.title',
  },
  {
    path: 'profile/register',
    canActivate: [participantAnonymousGuard],
    loadComponent: () =>
      import('./pages/profile-register/profile-register-page').then(
        (m) => m.ProfileRegisterPage,
      ),
    title: 'profile.register.title',
  },
  {
    // The one page of this client that needs a session (FR 4.2). Everything
    // else is either public or authorized by a signed token from a mail.
    path: 'profile',
    canActivate: [participantSessionGuard],
    loadComponent: () =>
      import('./pages/profile/profile-page').then((m) => m.ProfilePage),
    title: 'profile.title',
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
