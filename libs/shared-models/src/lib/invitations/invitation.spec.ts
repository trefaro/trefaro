import {
  invitationParagraphs,
  invitationState,
  type InvitationCounts,
} from './invitation';

const counts = (
  overrides: Partial<InvitationCounts> = {},
): InvitationCounts => ({
  recipients: 10,
  sent: 0,
  failed: 0,
  ...overrides,
});

describe('invitationState', () => {
  it('is sending while anything has not been attempted', () => {
    expect(invitationState(counts({ sent: 9 }))).toBe('sending');
  });

  it('is sent once every address was written to', () => {
    expect(invitationState(counts({ sent: 10 }))).toBe('sent');
  });

  it('is partial when some address could not be reached', () => {
    expect(invitationState(counts({ sent: 9, failed: 1 }))).toBe('partial');
  });

  it('is sending even when only failures have come in so far', () => {
    // Two failed out of ten is not "partially sent" yet — eight are still to
    // come, and a page that said `partial` would look finished.
    expect(invitationState(counts({ failed: 2 }))).toBe('sending');
  });

  it('does not call an invitation with no recipients unsent forever', () => {
    // Every recipient erased since (the phase 5 functions do that): nothing is
    // pending, so the send is over rather than stuck.
    expect(invitationState({ recipients: 0, sent: 0, failed: 0 })).toBe('sent');
  });
});

describe('invitationParagraphs', () => {
  it('splits on blank lines', () => {
    expect(invitationParagraphs('First line.\n\nSecond one.')).toEqual([
      'First line.',
      'Second one.',
    ]);
  });

  it('keeps a single line break inside a paragraph', () => {
    // A hard-wrapped paragraph is one paragraph: the author pressed return
    // once, not twice.
    expect(invitationParagraphs('Dear all,\nwe meet again.')).toEqual([
      'Dear all,\nwe meet again.',
    ]);
  });

  it('drops empty paragraphs however many blank lines there are', () => {
    expect(invitationParagraphs('One.\n\n\n\n   \n\nTwo.')).toEqual([
      'One.',
      'Two.',
    ]);
  });

  it('is empty for text that is only whitespace', () => {
    expect(invitationParagraphs('   \n\n  ')).toEqual([]);
  });
});
