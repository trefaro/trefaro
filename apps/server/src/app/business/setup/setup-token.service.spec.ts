import { SetupTokenService } from './setup-token.service';

/**
 * The secret that decides who claims a fresh instance (E28).
 */
describe('SetupTokenService', () => {
  let tokens: SetupTokenService;

  beforeEach(() => {
    tokens = new SetupTokenService();
  });

  it('issues nothing until asked, so a set-up instance holds no secret', () => {
    expect(tokens.isIssued()).toBe(false);
    // Nothing matches while nothing was issued — including the empty string and
    // whatever a caller sends when they send no header at all.
    expect(tokens.matches('')).toBe(false);
    expect(tokens.matches(undefined)).toBe(false);
  });

  it('issues one token and keeps returning it', () => {
    const token = tokens.issue();

    expect(token).not.toHaveLength(0);
    expect(tokens.issue()).toBe(token);
    expect(tokens.isIssued()).toBe(true);
    expect(tokens.matches(token)).toBe(true);
  });

  it('is long enough that guessing it is not a threat model', () => {
    // 32 random bytes in base64url. The reason it matters: this route carries no
    // rate limit tighter than the global one, and that choice rests on the
    // token's size (E4 — a limit nobody can trip is a limit nobody tests).
    expect(tokens.issue().length).toBeGreaterThanOrEqual(43);
  });

  it('gives two instances two different tokens', () => {
    expect(tokens.issue()).not.toBe(new SetupTokenService().issue());
  });

  it('refuses a value of the wrong type or length without throwing', () => {
    tokens.issue();

    // `timingSafeEqual` throws on buffers of different length, which would turn
    // a wrong token into a 500 instead of a 401.
    expect(tokens.matches('short')).toBe(false);
    expect(tokens.matches(42)).toBe(false);
    expect(tokens.matches(null)).toBe(false);
    expect(tokens.matches(['a'])).toBe(false);
  });

  it('rejects everything once discarded', () => {
    const token = tokens.issue();
    tokens.discard();

    expect(tokens.matches(token)).toBe(false);
    expect(tokens.isIssued()).toBe(false);
  });
});
