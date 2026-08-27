import type { TrefaroEnv } from '../../core/config/env';
import {
  CONFIRMATION_TOKEN_TTL_MS,
  TokenSigner,
  type TokenPurpose,
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

    // Cast because there is only one purpose today; the check is what makes
    // adding the self-service link of AP 9 safe, so it is tested before it has
    // a second caller.
    expect(
      signer.verify('registration-self-service' as TokenPurpose, token),
    ).toBeNull();
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
