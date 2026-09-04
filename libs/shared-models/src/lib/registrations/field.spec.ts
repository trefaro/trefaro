import { formatAnswer } from './field';

/**
 * How an answer reads (F31, and AP 13 of phase 3 for the words).
 *
 * Small, and here because the signature changed for a reason worth holding
 * still: a tick used to read `yes` in every language, in both clients. The
 * words now come from the caller, and what this library still decides is the
 * one thing that is not a word — the dash for a question nobody answered.
 */
describe('formatAnswer', () => {
  const words = { yes: 'Ja', no: 'Nein' };

  it('reads a tick in the words it was given', () => {
    expect(formatAnswer(true, words)).toBe('Ja');
    expect(formatAnswer(false, words)).toBe('Nein');
  });

  it('reads an unanswered question as a dash', () => {
    // Both shapes an unanswered question arrives in: never stored, or stored
    // and emptied again.
    expect(formatAnswer(undefined, words)).toBe('—');
    expect(formatAnswer('', words)).toBe('—');
  });

  it('hands text back untouched', () => {
    // Including something that looks like an answer to a different question:
    // what somebody typed is not this function's business.
    expect(formatAnswer('Bonn', words)).toBe('Bonn');
    expect(formatAnswer('no', words)).toBe('no');
  });
});
