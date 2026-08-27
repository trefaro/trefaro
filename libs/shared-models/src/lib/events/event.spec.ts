import { publicEventPath } from './event';

/**
 * The public address of an event (F28).
 *
 * One assertion about a one-line function, and it is worth having: the shape is
 * a decision rather than a formatting choice. Slugs are unique per parent (E7),
 * so the series has to be part of the path — and every caller that builds it by
 * hand is a link that works everywhere except in one mail.
 */
describe('publicEventPath', () => {
  it('nests the event inside its series', () => {
    expect(publicEventPath('democracy-days', 'kickoff-cologne')).toBe(
      '/series/democracy-days/events/kickoff-cologne',
    );
  });

  it('is absolute, so it can be appended to an origin', () => {
    expect(publicEventPath('a', 'b').startsWith('/')).toBe(true);
  });
});
