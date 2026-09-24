import { redactPath } from './redact-path';

describe('redactPath', () => {
  it('leaves a plain path exactly as it is', () => {
    expect(redactPath('/api/admin/events/8f1c')).toBe('/api/admin/events/8f1c');
  });

  it('keeps the questions and drops the answers', () => {
    // The one the acceptance criterion of AP 10 is about: the participant
    // overview's search box is where an organizer types somebody's surname
    // (F32), and until now a 500 on that page wrote it into the log.
    expect(
      redactPath('/api/admin/events/8f1c/registrations?search=Schulze&page=2'),
    ).toBe('/api/admin/events/8f1c/registrations?search=…&page=…');
  });

  it('keeps a token out of the log, which is the sharper half', () => {
    expect(
      redactPath('/api/user/registrations/confirm?token=eyJhbGciOi.signed'),
    ).toBe('/api/user/registrations/confirm?token=…');
  });

  it('says a key was there even when it stood alone', () => {
    expect(redactPath('/api/config?fresh')).toBe('/api/config?fresh=…');
  });

  it('survives the shapes a caller can invent', () => {
    expect(redactPath('')).toBe('');
    expect(redactPath('/api/events?')).toBe('/api/events');
    expect(redactPath('/api/events?&&')).toBe('/api/events');
    expect(redactPath('/api/events?a=1#b=2')).toBe('/api/events?a=…');
  });

  it('does not let a value smuggle a second question mark past it', () => {
    expect(redactPath('/api/events?q=a?b=c')).toBe('/api/events?q=…');
  });
});
