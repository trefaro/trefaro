import { QueryFailedError } from 'typeorm';
import { isUniqueViolation } from './unique-violation';

/**
 * The one question eight repositories ask their driver (F138, AP 13).
 *
 * Worth a test of its own precisely because it was worth eight copies: the
 * callers use it as control flow — one turns it into a 409, one into a `null`,
 * one into "somebody else took the seat first" — so a helper that stopped
 * recognising a violation would turn a friendly answer into a 500 in three
 * places at once. The bare-object case is here because that is the branch the
 * one copy that had drifted was missing.
 */
describe('isUniqueViolation', () => {
  const wrapped = (code: string) =>
    new QueryFailedError('INSERT INTO "event" …', [], {
      code,
    } as unknown as Error);

  it('recognises a violation TypeORM wrapped', () => {
    expect(isUniqueViolation(wrapped('23505'))).toBe(true);
  });

  it('recognises a violation that arrives unwrapped', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('says no to another SQLSTATE', () => {
    // A foreign key violation is a different answer to the caller: a slug that
    // is taken can be reported, a parent row that is gone is a 404 or a bug.
    expect(isUniqueViolation(wrapped('23503'))).toBe(false);
  });

  it('says no to an error that carries no code at all', () => {
    expect(isUniqueViolation(new Error('connection terminated'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });
});
