import type { TrefaroEnv } from '../../core/config/env';
import {
  CONFIRMATION_TOKEN_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  SELF_SERVICE_GRACE_MS,
  TokenSigner,
  selfServiceTokenTtlMs,
} from './token-signer';

const SUBJECT = '11111111-2222-3333-4444-555555555555';

const signerWith = (secret: string): TokenSigner =>
  new TokenSigner({ authSecret: secret } as TrefaroEnv);

describe('TokenSigner', () => {
  let signer: TokenSigner;

  beforeEach(() => {
    signer = signerWith('a-test-secret-of-at-least-32-characters');
  });

  it('recognizes a token it signed itself', () => {
    const token = signer.sign(
      'registration-confirmation',
      SUBJECT,
      CONFIRMATION_TOKEN_TTL_MS,
    );

    expect(signer.verify('registration-confirmation', token)).toBe(SUBJECT);
  });

  it('produces a token that survives a URL and an e-mail client', () => {
    const token = signer.sign('registration-confirmation', SUBJECT, 60_000);

    // No padding, no slashes, no plus signs: a link that gets mangled on its way
    // through a mail client is indistinguishable from a forged one.
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it('rejects a token signed with another secret', () => {
    const token = signerWith('a-different-secret-of-32-characters!').sign(
      'registration-confirmation',
      SUBJECT,
      60_000,
    );

    expect(signer.verify('registration-confirmation', token)).toBeNull();
  });

  it('rejects a payload someone edited', () => {
    const token = signer.sign('registration-confirmation', SUBJECT, 60_000);
    const [, signature] = token.split('.');
    const forged = Buffer.from(
      `registration-confirmation|00000000-0000-0000-0000-000000000000|${Date.now() + 60_000}`,
      'utf8',
    ).toString('base64url');

    expect(
      signer.verify('registration-confirmation', `${forged}.${signature}`),
    ).toBeNull();
  });

  it('rejects a signature someone edited', () => {
    const token = signer.sign('registration-confirmation', SUBJECT, 60_000);
    const [payload, signature] = token.split('.');
    const flipped = signature.startsWith('A')
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;

    expect(
      signer.verify('registration-confirmation', `${payload}.${flipped}`),
    ).toBeNull();
  });

  it('rejects a token whose signature is a different length', () => {
    const token = signer.sign('registration-confirmation', SUBJECT, 60_000);

    // Guards the constant-time comparison, which throws on unequal lengths.
    expect(signer.verify('registration-confirmation', `${token}xy`)).toBeNull();
  });

  it('rejects a token issued for another purpose', () => {
    const token = signer.sign('registration-confirmation', SUBJECT, 60_000);

    // The rule that keeps a confirmation link from being replayed as a
    // self-service link (E11): the two grant different things, and the purpose
    // is inside the signature rather than beside it.
    expect(signer.verify('registration-self-service', token)).toBeNull();
  });

  it('does not accept a self-service token as a confirmation either', () => {
    const token = signer.sign('registration-self-service', SUBJECT, 60_000);

    // Both directions, because only one of them would be the dangerous one and
    // a test that pins the harmless direction proves nothing.
    expect(signer.verify('registration-confirmation', token)).toBeNull();
    expect(signer.verify('registration-self-service', token)).toBe(SUBJECT);
  });

  it('keeps the objection link out of every other purpose (F58)', () => {
    const optOut = signer.sign('invitation-opt-out', SUBJECT, 60_000);

    // The only link this application mints that can nothing but *reduce* what
    // happens to its holder — and precisely therefore it must not be usable to
    // do anything else.
    expect(signer.verify('invitation-opt-out', optOut)).toBe(SUBJECT);
    expect(signer.verify('registration-confirmation', optOut)).toBeNull();
    expect(signer.verify('registration-self-service', optOut)).toBeNull();

    const confirmation = signer.sign(
      'registration-confirmation',
      SUBJECT,
      60_000,
    );
    expect(signer.verify('invitation-opt-out', confirmation)).toBeNull();
  });

  it('keeps a password reset out of every other purpose', () => {
    const reset = signer.sign('password-reset', SUBJECT, PASSWORD_RESET_TTL_MS);

    // The one link that takes an account over rather than confirming it, so the
    // direction that matters is both: no other token may be spent as a reset,
    // and a reset may be spent as nothing else.
    expect(signer.verify('password-reset', reset)).toBe(SUBJECT);
    expect(signer.verify('profile-confirmation', reset)).toBeNull();
    expect(signer.verify('registration-self-service', reset)).toBeNull();
    expect(signer.verify('invitation-opt-out', reset)).toBeNull();

    const confirmation = signer.sign('profile-confirmation', SUBJECT, 60_000);
    expect(signer.verify('password-reset', confirmation)).toBeNull();
  });

  it('expires a password reset within the hour', () => {
    // Not the fourteen days of a confirmation: that link only confirms an
    // address somebody asked to confirm, this one hands the account over.
    expect(PASSWORD_RESET_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('rejects an expired token', () => {
    const token = signer.sign('registration-confirmation', SUBJECT, -1);

    expect(signer.verify('registration-confirmation', token)).toBeNull();
  });

  it('rejects garbage without throwing', () => {
    for (const value of ['', '.', 'no-dot', 'a.b', '$$$.$$$']) {
      expect(signer.verify('registration-confirmation', value)).toBeNull();
    }
  });
});

describe('TokenSigner.mark', () => {
  const signer = signerWith('a-test-secret-of-at-least-32-characters');

  it('is the same mark for the same value', () => {
    expect(signer.mark('$argon2id$v=19$m=65536,t=3,p=4$abc$def')).toBe(
      signer.mark('$argon2id$v=19$m=65536,t=3,p=4$abc$def'),
    );
  });

  it('is a different mark once the value changes', () => {
    // The whole of "a reset link works once": the value marked is the password
    // hash, so setting a password spends every token minted against the old one.
    expect(signer.mark('old-hash')).not.toBe(signer.mark('new-hash'));
  });

  it('is a different mark under a different secret', () => {
    expect(
      signerWith('a-different-secret-of-32-characters!').mark('same'),
    ).not.toBe(signer.mark('same'));
  });

  it('survives a URL, because it travels inside a subject', () => {
    const mark = signer.mark('$argon2id$v=19$m=65536,t=3,p=4$abc$def');

    expect(mark).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(mark)).toBe(mark);
  });
});

describe('selfServiceTokenTtlMs', () => {
  it('reaches thirty days past the end of the event (E11)', () => {
    const endsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    const ttl = selfServiceTokenTtlMs(endsAt);

    // Ten days until the event ends plus the grace period, give or take the
    // milliseconds this assertion took.
    expect(ttl).toBeGreaterThan(SELF_SERVICE_GRACE_MS + 9 * 86_400_000);
    expect(ttl).toBeLessThanOrEqual(SELF_SERVICE_GRACE_MS + 10 * 86_400_000);
  });

  it('still grants the full grace period for an event long past', () => {
    // Somebody who confirms on the last day gets a link that works. What they
    // may still change is decided by the rules on each action, not by the
    // lifetime of the token.
    expect(selfServiceTokenTtlMs('2020-01-01T00:00:00.000Z')).toBe(
      SELF_SERVICE_GRACE_MS,
    );
  });

  it('falls back to the grace period for a date it cannot read', () => {
    expect(selfServiceTokenTtlMs('not a date')).toBeGreaterThanOrEqual(
      SELF_SERVICE_GRACE_MS,
    );
  });
});
