import { resetSubject, resetSubjectParts } from './password-reset-token';

const PROFILE = '11111111-2222-3333-4444-555555555555';
const MARK = 'GVhc3VyZS1tYXJr';

describe('the subject of a reset token', () => {
  it('reads back what it wrote', () => {
    expect(resetSubjectParts(resetSubject(PROFILE, MARK))).toEqual({
      profileId: PROFILE,
      passwordMark: MARK,
    });
  });

  it('carries the account first, so a log line stays readable', () => {
    expect(resetSubject(PROFILE, MARK).startsWith(PROFILE)).toBe(true);
  });

  it('refuses a subject without a mark', () => {
    // A plain account id is what every *other* purpose signs, and one of those
    // reaching this reader would mean a token was accepted that was never
    // minted against a password.
    expect(resetSubjectParts(PROFILE)).toBeNull();
  });

  it('refuses a subject with an empty half', () => {
    expect(resetSubjectParts(`${PROFILE}.`)).toBeNull();
    expect(resetSubjectParts(`.${MARK}`)).toBeNull();
    expect(resetSubjectParts('.')).toBeNull();
    expect(resetSubjectParts('')).toBeNull();
  });

  it('keeps a mark that contains the separator out', () => {
    // It cannot today — a mark is base64url — but a reader that split on the
    // first separator and ignored the rest would silently accept half a mark.
    expect(resetSubjectParts(`${PROFILE}.a.b`)).toBeNull();
  });
});
