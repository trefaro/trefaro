/**
 * First-run setup of a fresh instance (FR 1.1, AP 5 of phase 2).
 *
 * An instance that nobody has configured yet is reachable the moment
 * `docker compose up` returns, and every route that could create an
 * administrator sits behind an administrative session — so a fresh instance
 * without `ADMIN_BOOTSTRAP_*` would have no way in at all. These two endpoints
 * are that way in, and they exist **only** while `admin_user` is empty (E28).
 */

/**
 * Header carrying the setup token (E28).
 *
 * A header rather than a query parameter, which is where the self-service token
 * of phase 1 travels (F44): that one lives in a link somebody clicks, this one
 * is copied out of the server's startup log by the operator. Keeping it out of
 * the URL keeps it out of the reverse proxy's access log, and there is no link
 * preview service to consider.
 */
export const SETUP_TOKEN_HEADER = 'x-trefaro-setup-token';

/**
 * What the setup form needs to fill itself in, plus what the operator should
 * know about this deployment.
 *
 * Only readable with the token — the availability of the setup itself is
 * readable without one, because the status code carries it: 401 means "not set
 * up yet, wrong token", 404 means "there is an administrator". That is what lets
 * the organizer client decide which screen to show before anybody has typed
 * anything, without the body ever being handed out.
 */
export interface SetupState {
  readonly organizationName: string;
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly defaultLocale: string;
  /**
   * The languages this image can be set to today: the locales it ships mail
   * templates for. Grows into the language administration in AP 7 — a locale
   * with no mail templates would silently send English confirmations.
   */
  readonly locales: readonly string[];
  /**
   * Findings about this deployment, in the operator's language of record
   * (English), identical to the lines the server logs on startup.
   *
   * Not errors: an instance with these runs. They are the values whose absence
   * only shows up much later — no mail server means the first registration
   * cannot be confirmed, a public URL without TLS means nobody outside
   * `localhost` can hold a session at all (E2).
   */
  readonly warnings: readonly string[];
}

/** Everything the wizard writes, in one request. */
export interface SetupSubmission {
  readonly admin: {
    readonly email: string;
    readonly name: string;
    readonly password: string;
  };
  readonly organizationName: string;
  readonly defaultLocale: string;
  readonly primaryColor: string;
  readonly accentColor: string;
}

/**
 * What the wizard reports back — deliberately not a session.
 *
 * The operator signs in afterwards, on the login form, with the account they
 * just created. Handing out a session here would be convenient and would hide
 * the one thing worth finding out immediately: whether this deployment can hold
 * a session at all. The cookie is `Secure` in production (E2), so over plain
 * HTTP outside `localhost` the login fails — a wizard that logged the operator
 * in would let them discover that on their next visit instead.
 */
export interface SetupResult {
  readonly adminEmail: string;
  readonly organizationName: string;
}
