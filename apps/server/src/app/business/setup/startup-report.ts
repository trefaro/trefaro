import type { TrefaroEnv } from '../../core/config/env';

/**
 * What this deployment is missing without being broken (NFR 15, FR 1.1).
 *
 * `loadEnv` already refuses to start an instance whose configuration cannot
 * work — a production instance without `AUTH_SECRET`, `SMTP_HOST` or a database
 * password never reaches this code. What is left is the harder class: values
 * that are *present* and *wrong for a real deployment*, where the symptom
 * arrives days later and somewhere else. Nobody can hold a session over plain
 * HTTP because the cookie is `Secure` (E2); a registration cannot be confirmed
 * because the mail goes to a Mailpit that is not there; push cannot be switched
 * on because there is no key pair.
 *
 * One pure function, two readers: the startup log, where the operator who typed
 * `docker compose up` will look, and the first-run setup's state, which is the
 * same operator's other window (AP 5). A second copy of this list in a document
 * would be the copy that goes stale.
 *
 * The lines are English regardless of the instance's language: they are for
 * whoever installs the instance, not for its visitors, and they end up in a
 * container log that no translation catalogue reaches.
 */
export function startupWarnings(env: TrefaroEnv): readonly string[] {
  const warnings: string[] = [];
  const production = env.nodeEnv === 'production';

  for (const [name, url] of [
    ['PUBLIC_USER_CLIENT_URL', env.publicUserClientUrl],
    ['PUBLIC_ADMIN_CLIENT_URL', env.publicAdminClientUrl],
  ] as const) {
    // The session cookie carries `Secure` in production (E2), and a browser
    // stores such a cookie only over HTTPS — with the one exception every
    // browser makes for `localhost`. So this is not a hardening remark: without
    // TLS nobody can log in to this instance at all, which is why TLS belongs to
    // the installation and not to a later phase (E29).
    if (production && !isSecureOrigin(url)) {
      warnings.push(
        `${name} is ${url}: administrators cannot sign in over plain HTTP, because ` +
          'the session cookie is Secure. Terminate TLS in front of this instance ' +
          '(infra/docker-compose.tls.yml) and set both public URLs to https.',
      );
    }
  }

  if (production && isLocalHost(env.smtp.host)) {
    warnings.push(
      `SMTP_HOST is ${env.smtp.host}: registrations need a double opt-in mail, so ` +
        "nobody can complete one until this points at the organization's mail server.",
    );
  }

  if (production && !isRoutableSender(env.smtp.from)) {
    warnings.push(
      `SMTP_FROM is ${env.smtp.from}: a sender without a real domain is rejected or ` +
        "silently dropped by most mail servers. Use an address at the organization's " +
        'own domain.',
    );
  }

  if (!env.webPush) {
    warnings.push(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set: the push module can be ' +
        'switched on but will not offer a subscription. Generate a pair with ' +
        '`npx web-push generate-vapid-keys`.',
    );
  }

  if (production && !env.database.ssl && looksRemote(env.database.host)) {
    warnings.push(
      `DATABASE_HOST is ${env.database.host} and DATABASE_SSL is off: credentials and ` +
        'participant data cross the network unencrypted.',
    );
  }

  return warnings;
}

/**
 * Whether an envelope sender could survive a receiving mail server.
 *
 * Only the shape of the domain is looked at — a dot, and not `localhost`. What
 * is *not* checked is whether it is the organization's own domain: that depends
 * on SPF and DKIM records this application cannot see, and a rule that guesses
 * would either warn about every correct address or about none.
 *
 * The development default (`no-reply@localhost`) is the realistic mistake: it is
 * in `.env.example`, it works against Mailpit, and it fails silently against a
 * real relay.
 */
function isRoutableSender(from: string): boolean {
  const address = from.trim().replace(/^.*</, '').replace(/>$/, '');
  const domain = address.split('@').pop() ?? '';
  return domain.includes('.') && !isLocalHost(domain);
}

/**
 * Whether a host is somewhere else on a network, rather than beside us.
 *
 * A bare label is a service on the container network (`postgres` in
 * `infra/docker-compose.yml`), which nothing outside the stack can address —
 * encrypting that hop buys nothing and the warning would fire on every default
 * installation, which is how a checklist becomes noise. A dotted name or an
 * address is a hop somebody could be sitting on.
 */
function looksRemote(host: string): boolean {
  return host.includes('.') && !isLocalHost(host);
}

/** `https`, or one of the origins browsers treat as secure anyway. */
function isSecureOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || isLocalHost(parsed.hostname);
  } catch {
    // An unparseable URL is a different problem, and CORS will make it loud.
    return false;
  }
}

function isLocalHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '[::1]';
}
