import { Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';

/**
 * Password hashing for administrator accounts.
 *
 * argon2id at the library's defaults: memory-hard, which is what makes an
 * offline attack on a stolen database expensive. The parameters are not
 * configurable on purpose — an organization running its own instance should not
 * have to reason about them.
 */
@Injectable()
export class PasswordHasher {
  /** Built on first use, so a fresh instance pays for it only if it needs it. */
  private decoyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      // A stored hash we cannot parse means "no match", not a server error.
      return false;
    }
  }

  /**
   * Spends the time a real verification would take.
   *
   * Called when no account matched the address, so that response times do not
   * tell an attacker which addresses have an administrator account.
   */
  async equalizeTiming(password: string): Promise<void> {
    this.decoyHash ??= this.hash('trefaro-timing-equalizer');
    await this.verify(await this.decoyHash, password);
  }
}
