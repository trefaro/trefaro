/**
 * Typed, validated access to the process environment.
 *
 * Every configuration value the server needs is declared here exactly once so
 * an instance fails fast on startup with a complete list of problems, instead
 * of surfacing a missing value deep inside a request (NFR 11). Keeping the
 * environment in one typed shape also keeps `ConfigService.get('SOME_STRING')`
 * lookups out of the business layer.
 */

export type NodeEnv = 'development' | 'test' | 'production';

export interface DatabaseEnv {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly name: string;
  readonly ssl: boolean;
  /**
   * TypeORM schema auto-sync. Migrations are the only schema authority, so this
   * stays off outside development — `loadEnv` refuses to enable it in production.
   */
  readonly synchronize: boolean;
}

export interface SmtpEnv {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string | null;
  readonly password: string | null;
  /** Envelope sender for all outgoing mail (double opt-in, organizer replies). */
  readonly from: string;
}

/** Administrative access to the instance (FR 1.2, FR 1.3). */
export interface AdminAuthEnv {
  /** How long an administrative session survives without being used. */
  readonly sessionTtlHours: number;
  /**
   * The first administrator, created only while `admin_user` is still empty
   * (F22). `null` once the organization maintains its own accounts — which is
   * the normal state; phase 2 replaces this with a guided first-run setup.
   */
  readonly bootstrap: {
    readonly email: string;
    readonly password: string;
  } | null;
}

/** VAPID key pair for self-hosted Web Push (F7 — no third-party push service). */
export interface WebPushEnv {
  readonly publicKey: string;
  readonly privateKey: string;
  /** `mailto:` or https URL identifying the sender to the push service. */
  readonly subject: string;
}

export interface TrefaroEnv {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  /** Directory for uploaded files — logos, avatars, registration attachments (F12). */
  readonly uploadDir: string;
  /**
   * Directory holding the curated plug-ins' web component bundles.
   *
   * The server serves these under `/api/plugins`, so a bundle URL is same-origin
   * for both clients in development (through the dev-server proxy) and in
   * production (through the NGINX reverse proxy) without any extra routing.
   */
  readonly pluginBundleDir: string;
  /** Public origins of both clients: CORS allow-list and link base for e-mails. */
  readonly publicUserClientUrl: string;
  readonly publicAdminClientUrl: string;
  /** Signing secret for auth tokens and double opt-in confirmation links. */
  readonly authSecret: string;
  readonly adminAuth: AdminAuthEnv;
  readonly database: DatabaseEnv;
  readonly smtp: SmtpEnv;
  /** `null` until the organization has generated a VAPID key pair. */
  readonly webPush: WebPushEnv | null;
}

export class EnvValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `Invalid server configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'EnvValidationError';
  }
}

const DEV_PLACEHOLDER_SECRET =
  'trefaro-development-secret-do-not-use-in-production';

/** Collects every problem instead of throwing on the first one. */
class EnvReader {
  readonly problems: string[] = [];

  constructor(
    private readonly source: Readonly<Record<string, string | undefined>>,
    private readonly production: boolean,
  ) {}

  optional(key: string, fallback: string): string {
    const raw = this.source[key]?.trim();
    return raw ? raw : fallback;
  }

  /** Required in production; falls back to a development default otherwise. */
  required(key: string, developmentFallback: string): string {
    const raw = this.source[key]?.trim();
    if (raw) return raw;
    if (this.production) {
      this.problems.push(`${key} is required when NODE_ENV=production`);
      return '';
    }
    return developmentFallback;
  }

  integer(key: string, fallback: number): number {
    const raw = this.source[key]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      this.problems.push(`${key} must be a positive integer, got "${raw}"`);
      return fallback;
    }
    return value;
  }

  boolean(key: string, fallback: boolean): boolean {
    const raw = this.source[key]?.trim().toLowerCase();
    if (!raw) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    this.problems.push(`${key} must be a boolean, got "${raw}"`);
    return fallback;
  }
}

function readNodeEnv(raw: string | undefined, problems: string[]): NodeEnv {
  const value = raw?.trim() || 'development';
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  problems.push(
    `NODE_ENV must be one of development, test, production — got "${value}"`,
  );
  return 'development';
}

/**
 * Validates the environment and returns it as one typed object.
 *
 * @throws EnvValidationError listing every problem found.
 */
export function loadEnv(
  source: Readonly<Record<string, string | undefined>> = process.env,
): TrefaroEnv {
  const preflight: string[] = [];
  const nodeEnv = readNodeEnv(source['NODE_ENV'], preflight);
  const production = nodeEnv === 'production';
  const read = new EnvReader(source, production);
  read.problems.push(...preflight);

  const authSecret = read.required('AUTH_SECRET', DEV_PLACEHOLDER_SECRET);
  if (production && authSecret && authSecret.length < 32) {
    read.problems.push('AUTH_SECRET must be at least 32 characters long');
  }

  const synchronize = read.boolean('DATABASE_SYNCHRONIZE', false);
  if (production && synchronize) {
    read.problems.push(
      'DATABASE_SYNCHRONIZE must be off in production — migrations are the only schema authority',
    );
  }

  const bootstrapEmail = source['ADMIN_BOOTSTRAP_EMAIL']?.trim() ?? '';
  const bootstrapPassword = source['ADMIN_BOOTSTRAP_PASSWORD']?.trim() ?? '';
  if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) {
    read.problems.push(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set together (or both left empty once an administrator exists)',
    );
  }

  const vapidPublicKey = source['VAPID_PUBLIC_KEY']?.trim() ?? '';
  const vapidPrivateKey = source['VAPID_PRIVATE_KEY']?.trim() ?? '';
  if (Boolean(vapidPublicKey) !== Boolean(vapidPrivateKey)) {
    read.problems.push(
      'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together (or both left empty to disable push)',
    );
  }

  const env: TrefaroEnv = {
    nodeEnv,
    // Deliberately not `PORT`: Vite, and therefore the Angular dev server,
    // reads `PORT` too and would silently move a client off its configured
    // port onto the server's.
    port: read.integer('SERVER_PORT', 3000),
    uploadDir: read.optional('UPLOAD_DIR', './tmp/uploads'),
    pluginBundleDir: read.optional('PLUGIN_BUNDLE_DIR', './dist/apps/plugins'),
    publicUserClientUrl: read.optional(
      'PUBLIC_USER_CLIENT_URL',
      'http://localhost:4200',
    ),
    publicAdminClientUrl: read.optional(
      'PUBLIC_ADMIN_CLIENT_URL',
      'http://localhost:4300',
    ),
    authSecret,
    adminAuth: {
      sessionTtlHours: read.integer('ADMIN_SESSION_TTL_HOURS', 12),
      // The password policy itself lives with the login module, which is the
      // only place that may decide what a usable password is.
      bootstrap:
        bootstrapEmail && bootstrapPassword
          ? { email: bootstrapEmail, password: bootstrapPassword }
          : null,
    },
    database: {
      host: read.optional('DATABASE_HOST', 'localhost'),
      port: read.integer('DATABASE_PORT', 5432),
      user: read.optional('DATABASE_USER', 'trefaro'),
      password: read.required('DATABASE_PASSWORD', 'trefaro_dev'),
      name: read.optional('DATABASE_NAME', 'trefaro'),
      ssl: read.boolean('DATABASE_SSL', false),
      synchronize,
    },
    smtp: {
      host: read.optional('SMTP_HOST', 'localhost'),
      port: read.integer('SMTP_PORT', 1025),
      secure: read.boolean('SMTP_SECURE', false),
      user: source['SMTP_USER']?.trim() || null,
      password: source['SMTP_PASSWORD']?.trim() || null,
      from: read.optional('SMTP_FROM', 'Trefaro <no-reply@localhost>'),
    },
    webPush:
      vapidPublicKey && vapidPrivateKey
        ? {
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
            subject: read.optional('VAPID_SUBJECT', 'mailto:admin@localhost'),
          }
        : null,
  };

  if (read.problems.length > 0) {
    throw new EnvValidationError(read.problems);
  }
  return env;
}
