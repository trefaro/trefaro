import { Route } from '@angular/router';
import {
  participantAnonymousGuard,
  participantSessionGuard,
} from './features/auth/participant-session.guard';
import { profileSearchGuard } from './features/profiles/profile-search.service';

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
 * AP 5 adds the two pages of the participant search (FR 4.4), both behind the
 * session **and** behind the `profile-search` module: a bookmark that outlives
 * the switch leads to the start page rather than to a search that answers 404.
 *
 * Since AP 4 of phase 3 the login is a second way to the same self-service:
 * `registrations` lists what an address holds and `registrations/:id` opens one
 * of them with no token at all — the same component as `registrations/me`,
 * because the view and its rules are identical.
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
    // for the confirmation above. Before `registrations/:id`, so a link from a
    // mail is never read as an id.
    path: 'registrations/me',
    loadComponent: () =>
      import('./pages/my-registration/my-registration-page').then(
        (m) => m.MyRegistrationPage,
      ),
    title: 'mine.title',
  },
  {
    // What the navigation points at once somebody is signed in (FR 4.7): the
    // list a token cannot open, because a token speaks for one registration.
    path: 'registrations',
    pathMatch: 'full',
    canActivate: [participantSessionGuard],
    loadComponent: () =>
      import('./pages/my-registrations/my-registrations-page').then(
        (m) => m.MyRegistrationsPage,
      ),
    title: 'mine.list.title',
  },
  {
    // The same page as `registrations/me`, reached without a token: the id
    // comes from the path and the session says whose it is (E31).
    path: 'registrations/:id',
    canActivate: [participantSessionGuard],
    loadComponent: () =>
      import('./pages/my-registration/my-registration-page').then(
        (m) => m.MyRegistrationPage,
      ),
    title: 'mine.title',
  },
  {
    // The community directory of AP 5 (FR 4.4). Two guards, and they answer
    // two different questions: the session decides whether somebody may see
    // the page, the module whether this instance runs one at all (F53).
    path: 'participants',
    pathMatch: 'full',
    canActivate: [participantSessionGuard, profileSearchGuard],
    loadComponent: () =>
      import('./pages/people/people-page').then((m) => m.PeoplePage),
    title: 'people.title',
  },
  {
    // Somebody else's profile. The same title as the search: this is that
    // section of the client, and the tab cannot carry a name it has not
    // fetched yet.
    path: 'participants/:id',
    canActivate: [participantSessionGuard, profileSearchGuard],
    loadComponent: () =>
      import('./pages/people/person-page').then((m) => m.PersonPage),
    title: 'people.title',
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
