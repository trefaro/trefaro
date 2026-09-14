/**
 * The instance's rate limits: their defaults, and what to say when they move.
 *
 * Until phase 5 these numbers were constants next to the controllers that used
 * them, which made them impossible to adjust without a rebuild — and an
 * operator whose office shares one public address had no answer but a fork.
 * They are configuration now (E60). What has *not* changed is the numbers: the
 * defaults below are exactly what the instance shipped with, so an operator who
 * sets nothing gets what every test in this repository was written against.
 *
 * A limit that is raised is a limit nobody is testing any more (E4), so raising
 * one is never silent: {@link rateLimitWarnings} turns every value above its
 * default into a line in the startup log, and names the profile it came from
 * (E61). Lowering one is not a warning — it is the direction that stays safe.
 */

/** Every configurable limit, as one typed block of the environment. */
export interface RateLimitEnv {
  /**
   * Login attempts allowed per client address per five minutes, for every
   * login there is — the organizer login (UC 01) and the participant login
   * (FR 4.2), because the two are the same kind of door.
   *
   * Twenty, then fifteen minutes of silence. The block is what makes guessing
   * pointless: roughly 1 900 attempts a day against an argon2id hash of a
   * passphrase of at least twelve characters is not an attack, it is a
   * rounding error.
   *
   * Also read outside the server —
   * `tools/spike-verification/verify-admin-access.mjs` proves the block
   * actually happens against an instance running the defaults.
   */
  readonly loginAttemptsPerWindow: number;
  /**
   * Registration attempts allowed per client address per five minutes.
   *
   * Every accepted registration sends a mail, so this endpoint is a way to
   * send mail to someone else's inbox — the reason it is tighter than the
   * global default. Deliberately without a block period, unlike the login: a
   * participant who mistypes their address a few times has to be able to fix
   * it. Sixty because an office or a school shares one public address, so
   * twenty colleagues signing up for the same event within a few minutes are
   * one client here.
   */
  readonly registrationsPerWindow: number;
  /**
   * Newsletter sign-ups allowed per client address per five minutes.
   *
   * Lower than the sixty of the registration and account forms, because this
   * one has less to be legitimately repeated for: a household filling in one
   * form after another is registering people for an event, and nobody signs
   * twenty addresses up for news from one browser.
   */
  readonly newsletterSignupsPerWindow: number;
  /**
   * Confirmations allowed per client address per five minutes.
   *
   * The same number as registering, for the same reason: the two belong to one
   * flow, and a household behind a single address has to be able to complete
   * as many opt-ins as it started. The only thing this limit defends against
   * is guessing an HMAC, where thirty attempts and sixty are equally hopeless.
   */
  readonly confirmationsPerWindow: number;
  /**
   * Mails one **recipient address** may be sent per five minutes, counted
   * across every public route that mails to an address the caller chose.
   *
   * The second counter of phase 5, and the one the other four cannot replace:
   * they count the *caller*, and a caller is free to change address. Five,
   * because the legitimate ceiling decides it — a household signing its
   * members up for one event is the case that must not break, and that is a
   * handful, not a hundred. Above it, this instance stops being a way to fill
   * a stranger's inbox.
   */
  readonly mailsPerRecipientPerWindow: number;
  /**
   * Name of the profile these values came from, or `null` for the defaults.
   *
   * Free text, and deliberately not a switch: the profile changes nothing by
   * itself, it only gives the startup log a word for *why* the numbers are not
   * the shipped ones (E61). A production stack sets it never.
   */
  readonly profile: string | null;
}

/** What the instance ships with. Every default here is a number that was already in force. */
export const RATE_LIMIT_DEFAULTS = {
  loginAttemptsPerWindow: 20,
  registrationsPerWindow: 60,
  newsletterSignupsPerWindow: 20,
  confirmationsPerWindow: 60,
  mailsPerRecipientPerWindow: 5,
} as const satisfies Omit<RateLimitEnv, 'profile'>;

/** The environment variable each limit is read from, for the startup log. */
const VARIABLE_NAMES = {
  loginAttemptsPerWindow: 'LOGIN_ATTEMPTS_PER_WINDOW',
  registrationsPerWindow: 'REGISTRATIONS_PER_WINDOW',
  newsletterSignupsPerWindow: 'NEWSLETTER_SIGNUPS_PER_WINDOW',
  confirmationsPerWindow: 'CONFIRMATIONS_PER_WINDOW',
  mailsPerRecipientPerWindow: 'MAILS_PER_RECIPIENT_PER_WINDOW',
} as const satisfies Record<keyof typeof RATE_LIMIT_DEFAULTS, string>;

/**
 * What the instance should say out loud while starting, given its limits.
 *
 * One line per limit that sits above its default, plus one naming the profile
 * if there is one. Empty for an instance running what it shipped with —
 * silence means the defaults, which is the only state in which silence is
 * honest.
 */
export function rateLimitWarnings(limits: RateLimitEnv): string[] {
  const warnings: string[] = [];

  // First, because it explains every line that follows. Announced whenever it
  // is set, even by a profile that raises nothing: the point of E61 is that an
  // instance cannot be running one without saying so.
  if (limits.profile) {
    warnings.push(
      `Rate-limit profile "${limits.profile}" is active. A profile is never ` +
        'what an instance ships (E61).',
    );
  }

  for (const key of Object.keys(
    RATE_LIMIT_DEFAULTS,
  ) as (keyof typeof RATE_LIMIT_DEFAULTS)[]) {
    if (limits[key] > RATE_LIMIT_DEFAULTS[key]) {
      warnings.push(
        `${VARIABLE_NAMES[key]} is ${limits[key]}, above the default of ` +
          `${RATE_LIMIT_DEFAULTS[key]} — a raised limit is a limit nobody is testing (E4).`,
      );
    }
  }
  return warnings;
}
