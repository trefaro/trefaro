import { PasswordHasher } from './password-hasher.service';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('accepts the password it hashed', async () => {
    const hash = await hasher.hash('a-long-enough-secret');

    await expect(hasher.verify(hash, 'a-long-enough-secret')).resolves.toBe(
      true,
    );
  });

  it('rejects a different password', async () => {
    const hash = await hasher.hash('a-long-enough-secret');

    await expect(hasher.verify(hash, 'a-long-enough-secreT')).resolves.toBe(
      false,
    );
  });

  it('produces a different hash for the same password, so equal hashes reveal nothing', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('a-long-enough-secret'),
      hasher.hash('a-long-enough-secret'),
    ]);

    expect(first).not.toBe(second);
    expect(first).toContain('$argon2id$');
  });

  it('treats a stored hash it cannot parse as a mismatch, not a server error', async () => {
    await expect(hasher.verify('not-a-hash', 'whatever')).resolves.toBe(false);
  });

  it('equalizes timing without throwing when no account matched', async () => {
    await expect(hasher.equalizeTiming('whatever')).resolves.toBeUndefined();
  });
});
