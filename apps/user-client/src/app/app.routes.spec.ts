import {
  PROFILE_CONFIRMATION_PATH,
  PROFILE_LOGIN_PATH,
  SELF_SERVICE_PATH,
} from '@trefaro/shared-models';
import { appRoutes } from './app.routes';

/**
 * The two addresses the server writes into a mail have to exist here.
 *
 * `PROFILE_CONFIRMATION_PATH` and `PROFILE_LOGIN_PATH` live in `shared-models`
 * precisely so the mail and the client cannot drift apart (E5b, E32) — but a
 * shared constant only prevents a mismatch if this client actually routes it.
 * Renaming a route is the drift this test exists for: the failure mode without
 * it is a link in somebody's inbox that lands on the start page.
 */
describe('participant client routes', () => {
  const paths = appRoutes.map((route) => route.path);

  it.each([PROFILE_CONFIRMATION_PATH, PROFILE_LOGIN_PATH, SELF_SERVICE_PATH])(
    'routes %s, because a mail links to it',
    (path) => {
      expect(paths).toContain(path.replace(/^\//, ''));
    },
  );

  it('matches `registrations/me` before `registrations/:id`', () => {
    // Otherwise the link every confirmed participant has in their inbox is
    // read as an id, and a page they hold a valid token for asks them to log
    // in (E11).
    expect(paths.indexOf('registrations/me')).toBeLessThan(
      paths.indexOf('registrations/:id'),
    );
  });

  it('matches the more specific profile paths before `profile` itself', () => {
    const profile = paths.indexOf('profile');
    const children = paths.filter((path) => path?.startsWith('profile/'));

    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(paths.indexOf(child)).toBeLessThan(profile);
    }
  });
});
