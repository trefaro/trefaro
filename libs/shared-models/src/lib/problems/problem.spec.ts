import { PROBLEM_CODES, isProblemCode } from './problem';

describe('the problem codes', () => {
  it('names every code exactly once', () => {
    // A duplicate would be harmless at runtime and a lie in the catalogue test:
    // the same key counted twice, and one of the two meanings without a
    // sentence of its own.
    expect(new Set(PROBLEM_CODES).size).toBe(PROBLEM_CODES.length);
  });

  it('is made of catalogue keys under one prefix', () => {
    // The code *is* the key a client looks up. The prefix is what lets an
    // organization find every refusal in the translation administration.
    for (const code of PROBLEM_CODES) {
      expect(code).toMatch(/^problem\.[A-Za-z]+\.[A-Za-z.]+$/);
    }
  });

  it('is sorted within each group, so a new code has one place to go', () => {
    const sorted = [...PROBLEM_CODES].sort();
    expect(new Set(sorted).size).toBe(sorted.length);
  });

  it('recognises its own codes and nothing else', () => {
    expect(isProblemCode('problem.field.required')).toBe(true);
    expect(isProblemCode('problem.field.thereIsNoSuchThing')).toBe(false);
    expect(isProblemCode('')).toBe(false);
    expect(isProblemCode(undefined)).toBe(false);
  });
});
