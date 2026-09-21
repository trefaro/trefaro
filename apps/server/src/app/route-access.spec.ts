import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ALLOW_ANONYMOUS_METADATA } from './business/common/allow-anonymous';
import { isAdminPath } from './business/login/admin.guard';
import { isParticipantPath } from './business/profiles/participant.guard';
import { REQUIRES_PARTICIPANT_METADATA } from './business/profiles/requires-participant';

/**
 * Every address this image answers, and who may reach it (AP 9 of phase 5).
 *
 * The inventory a security review needs and the code could not be read for: the
 * two session guards are global and decide from the **declared** path (E16,
 * E33), so no single file says which endpoints are open. That is the property
 * that makes a forgotten `@UseGuards` harmless — and the same property that
 * makes an accidentally public endpoint invisible. A new controller under a
 * prefix nobody guards is a correct-looking file.
 *
 * So the list is checked in. Adding a public route means editing
 * {@link PUBLIC_ROUTES} and saying beside it why it is public; anything else
 * fails here rather than in somebody's session.
 *
 * It walks the module metadata rather than booting Nest, for the reason
 * `plugins/plugin-controllers.spec.ts` gives for the same choice: what is under
 * test is the declaration, and a test that needed a database is a test nobody
 * runs while writing a controller.
 */

/** What the two global guards make of a declared path. */
type Access = 'admin' | 'participant' | 'public';

interface Route {
  readonly method: string;
  readonly path: string;
  readonly access: Access;
  readonly controller: string;
}

const METHOD_NAMES = new Map<number, string>([
  [RequestMethod.GET, 'GET'],
  [RequestMethod.POST, 'POST'],
  [RequestMethod.PUT, 'PUT'],
  [RequestMethod.DELETE, 'DELETE'],
  [RequestMethod.PATCH, 'PATCH'],
  [RequestMethod.HEAD, 'HEAD'],
  [RequestMethod.OPTIONS, 'OPTIONS'],
  [RequestMethod.ALL, 'ALL'],
]);

/** The two source trees that contribute controllers: the core, and the plug-ins. */
const SOURCE_ROOTS = [resolve(__dirname), resolve(__dirname, '..', 'plugins')];

/** Every `*.controller.ts` below a root, in a stable order. */
function controllerFiles(root: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...controllerFiles(path));
    else if (/\.controller\.ts$/.test(entry.name)) found.push(path);
  }
  return found.sort();
}

/**
 * Every controller class in this image.
 *
 * Read from the source tree rather than from the module graph, and the
 * difference is deliberate in two directions. It does not need the data access
 * layer — a controller reaches a service, a service reaches a port, and the
 * linter keeps it that way — so this stays a test somebody runs while writing
 * one. And it over-approximates: a controller that exists but is not mounted
 * answers 404, which is an availability bug; a controller that exists and is
 * open is the thing this file is for.
 */
function allControllers(): readonly Type<unknown>[] {
  const found: Type<unknown>[] = [];
  for (const root of SOURCE_ROOTS) {
    for (const file of controllerFiles(root)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a
      // glob of modules cannot be a list of static imports.
      const module = require(file) as Record<string, unknown>;
      for (const exported of Object.values(module)) {
        if (
          typeof exported === 'function' &&
          Reflect.hasOwnMetadata(PATH_METADATA, exported)
        ) {
          found.push(exported as Type<unknown>);
        }
      }
    }
  }
  return found;
}

/** The path a decorator declared, without its slashes. */
function declaredPath(target: object): string {
  const path = Reflect.getMetadata(PATH_METADATA, target) as
    string | string[] | undefined;
  const single = Array.isArray(path) ? path[0] : path;
  return (single ?? '').replace(/^\/+|\/+$/g, '');
}

/** The handlers of a controller, as the decorators left them. */
function handlersOf(controller: Type<unknown>): readonly (() => unknown)[] {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => prototype[name])
    .filter(
      (value): value is () => unknown =>
        typeof value === 'function' &&
        Reflect.getMetadata(METHOD_METADATA, value) !== undefined,
    );
}

/** The same `Reflector` the guards use, asked about a declaration. */
const reflector = new Reflector();

function marked(
  key: string,
  controller: Type<unknown>,
  handler: () => unknown,
): boolean {
  return (
    reflector.getAllAndOverride<boolean | undefined>(key, [
      handler,
      controller,
    ]) === true
  );
}

function accessOf(
  controller: Type<unknown>,
  handler: () => unknown,
  paths: readonly string[],
): Access {
  if (marked(ALLOW_ANONYMOUS_METADATA, controller, handler)) return 'public';
  if (isAdminPath(...paths)) return 'admin';
  if (
    isParticipantPath(...paths) ||
    marked(REQUIRES_PARTICIPANT_METADATA, controller, handler)
  ) {
    return 'participant';
  }
  return 'public';
}

function routesOf(): readonly Route[] {
  const routes: Route[] = [];

  for (const controller of allControllers()) {
    const base = declaredPath(controller);
    for (const handler of handlersOf(controller)) {
      const tail = declaredPath(handler);
      const path = [base, tail].filter((part) => part.length > 0).join('/');
      const method =
        METHOD_NAMES.get(
          Reflect.getMetadata(METHOD_METADATA, handler) as number,
        ) ?? 'ALL';
      routes.push({
        method,
        path: `/api/${path}`,
        access: accessOf(controller, handler, [base, tail]),
        controller: controller.name,
      });
    }
  }

  return routes.sort((left, right) =>
    `${left.path} ${left.method}`.localeCompare(
      `${right.path} ${right.method}`,
    ),
  );
}

/**
 * Every address a visitor without any session may reach, and why.
 *
 * Three kinds are in here and no fourth: what the product promises to show
 * without a login (the start page, an event's landing page, the programme, the
 * configuration and the catalogue both clients render with), the four doors
 * into a session, and the token-authorized self-service of E11 — where the
 * signed link *is* the authorization and a session would be the wrong question.
 */
const PUBLIC_ROUTES: readonly string[] = [
  // The four doors into a session. Logging in has none yet; logging out must
  // not fail because one expired.
  'POST /api/admin/auth/login',
  'POST /api/admin/auth/logout',
  'POST /api/participant/auth/login',
  'POST /api/participant/auth/logout',

  // What both clients read before they render anything (E20, chapter 4) and
  // what makes the participant client installable (F20).
  'GET /api/config',
  'GET /api/config/manifest.webmanifest',
  'GET /api/i18n/:locale',

  // Liveness for the container health check and the proxy. Reports that the
  // database is unreachable, never why.
  'GET /api/health',

  // Stored bytes that are meant to be looked at: the instance's brand, a
  // series' logo, an event's, and a participant's avatar. The last one is the
  // one with an argument rather than an obvious answer — it is written out in
  // `profile-avatar-media.controller.ts`, and it depends on the id never
  // reaching somebody who may not see the profile. Registration attachments
  // are deliberately absent: they are served by one administrative route and
  // by nothing else (E9, E19).
  'GET /api/media/branding/app-icon',
  'GET /api/media/branding/logo',
  'GET /api/media/events/:id/logo',
  'GET /api/media/profiles/:id/avatar',
  'GET /api/media/series/:id/logo',

  // The first-run setup, which exists precisely while nobody can log in
  // (FR 1.1, E28). Anonymous to the session guards and not to `SetupGuard`,
  // which closes both routes the moment an administrator exists.
  'GET /api/setup/state',
  'POST /api/setup/admin',

  // The start page, an event's landing page and everything on it: the product
  // promises these without a login, and the thesis' first screen is one of
  // them.
  'GET /api/user/series',
  'GET /api/user/series/:slug',
  'GET /api/user/series/:seriesSlug/events',
  'GET /api/user/series/:seriesSlug/events/:eventSlug',
  'GET /api/user/series/:seriesSlug/events/:eventSlug/media-links',
  'GET /api/user/series/:seriesSlug/events/:eventSlug/program',
  'GET /api/user/series/:seriesSlug/events/:eventSlug/registration-fields',
  'GET /api/user/plugins/room-planning/events/:eventId/rooms',

  // Writes without a session, every one of them by product decision: signing
  // up (double opt-in), asking a question without an account, subscribing to
  // the newsletter, creating an account and confirming it, and the two halves
  // of a forgotten password. All six are rate-limited by name (E60), and the
  // three that send mail are additionally throttled per recipient address.
  'POST /api/user/series/:seriesSlug/events/:eventSlug/registrations',
  'POST /api/user/series/:seriesSlug/events/:eventSlug/contact',
  'POST /api/user/newsletter',
  'POST /api/user/newsletter/confirm',
  'POST /api/user/profiles',
  'POST /api/user/profiles/confirm',
  'POST /api/user/profiles/password-reset',
  'POST /api/user/profiles/password',
  'POST /api/user/registrations/confirm',

  // Push, which works with and without an account (E43): the subscription
  // belongs to a browser, and asking for a session would mean no notification
  // for anybody who never made one.
  'POST /api/user/push/subscriptions',
  'DELETE /api/user/push/subscriptions',

  // Token-authorized self-service (E11). The signed link *is* the
  // authorization, and each of these refuses a missing, forged or expired
  // token — a session would be the wrong question, because the person holding
  // the link may not have an account at all.
  'GET /api/user/registrations/me',
  'POST /api/user/registrations/me/cancellation',
  'PUT /api/user/program-items/:id/signup',
  'DELETE /api/user/program-items/:id/signup',
  'POST /api/user/invitations/opt-out',
  'POST /api/user/invitations/opt-out/one-click',
  'GET /api/user/plugins/qr-checkin/ticket',
];

describe('the addresses this image answers', () => {
  const routes = routesOf();

  it('finds them at all', () => {
    // Guards the test itself: a scan that stopped finding controllers would
    // make every assertion below pass over an empty list. The number is a
    // floor, not a count — a new endpoint must not have to edit this line.
    expect(routes.length).toBeGreaterThan(150);
  });

  it('declares every address exactly once', () => {
    // Two controllers on one address is not a theoretical mistake here: a
    // plug-in declares its own paths, and Express answers with whichever
    // handler was mounted first. The second one is then dead code that reads
    // like a guarded endpoint.
    const seen = new Map<string, string[]>();
    for (const route of routes) {
      const address = `${route.method} ${route.path}`;
      seen.set(address, [...(seen.get(address) ?? []), route.controller]);
    }
    expect(
      [...seen].filter(([, controllers]) => controllers.length > 1),
    ).toEqual([]);
  });

  it('opens exactly the routes that are meant to be open', () => {
    const open = routes
      .filter((route) => route.access === 'public')
      .map((route) => `${route.method} ${route.path}`);
    // Both sides sorted, because the list above is grouped by *why* a route is
    // open, and that grouping is the part worth reading.
    expect([...open].sort()).toEqual([...PUBLIC_ROUTES].sort());
  });
});
