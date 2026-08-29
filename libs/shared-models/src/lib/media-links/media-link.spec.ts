import { isTranslationKey } from '../i18n/catalogue';
import {
  MEDIA_LINK_KINDS,
  eventMediaLinks,
  groupMediaLinksByKind,
  isWebUrl,
  mediaLinkKindKey,
  programItemMediaLinks,
  sortMediaLinks,
  type MediaLinkKind,
  type PublicMediaLink,
} from './media-link';

const link = (
  id: string,
  kind: MediaLinkKind,
  programItemId: string | null = null,
): PublicMediaLink => ({
  id,
  kind,
  title: `Link ${id}`,
  url: `https://media.example.org/${id}`,
  programItemId,
});

describe('isWebUrl', () => {
  it('accepts http and https', () => {
    expect(isWebUrl('https://tube.example.org/watch/abc')).toBe(true);
    expect(isWebUrl('http://intranet.example.org/slides.pdf')).toBe(true);
    // Typed with a stray space, which is what a paste looks like.
    expect(isWebUrl('  https://tube.example.org/watch/abc  ')).toBe(true);
  });

  it('refuses anything a click must not execute or resolve', () => {
    // The reason this function exists: an href an organizer typed is a link a
    // visitor clicks.
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('data:text/html,<script></script>')).toBe(false);
    // A bare word would resolve against this instance and look like a broken
    // page rather than a mistyped link.
    expect(isWebUrl('tube.example.org')).toBe(false);
    expect(isWebUrl('')).toBe(false);
  });
});

describe('mediaLinkKindKey', () => {
  it('names a kind in the number it is talked about in', () => {
    expect(mediaLinkKindKey('stream')).toBe('mediaLinks.kind.stream.one');
    expect(mediaLinkKindKey('recording', 3)).toBe(
      'mediaLinks.kind.recording.many',
    );
  });

  it('builds a well-formed, distinct key for every kind there is', () => {
    // A malformed key cannot be stored as a translation override (F70), and two
    // kinds sharing one would make a heading say the wrong word.
    const keys = MEDIA_LINK_KINDS.flatMap((kind) => [
      mediaLinkKindKey(kind),
      mediaLinkKindKey(kind, 2),
    ]);

    expect(keys.every(isTranslationKey)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('sortMediaLinks', () => {
  it('orders by kind: what is on now, what can be watched again, what can be read', () => {
    const sorted = sortMediaLinks([
      link('c', 'material'),
      link('a', 'stream'),
      link('b', 'recording'),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the order within one kind alone', () => {
    // Stable, because "as they were added" is the second half of the rule (F52)
    // and the list arrives in that order.
    const sorted = sortMediaLinks([
      link('first', 'material'),
      link('second', 'material'),
      link('third', 'material'),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('does not change the list it was given', () => {
    const links = [link('b', 'material'), link('a', 'stream')];

    sortMediaLinks(links);

    expect(links.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('groupMediaLinksByKind', () => {
  it('builds one section per kind that has links, in the kinds’ order', () => {
    const groups = groupMediaLinksByKind([
      link('slides', 'material'),
      link('live', 'stream'),
      link('report', 'material'),
    ]);

    expect(groups.map((group) => group.kind)).toEqual(['stream', 'material']);
    expect(groups[0].labelKey).toBe('mediaLinks.kind.stream.many');
    expect(groups[1].links.map((entry) => entry.id)).toEqual([
      'slides',
      'report',
    ]);
  });

  it('leaves out a kind with nothing in it', () => {
    // A heading over nothing is a promise the page does not keep (F47).
    expect(groupMediaLinksByKind([])).toEqual([]);
    expect(groupMediaLinksByKind([link('a', 'recording')])).toHaveLength(1);
  });
});

describe('eventMediaLinks and programItemMediaLinks', () => {
  const links = [
    link('welcome', 'stream'),
    link('keynote-recording', 'recording', 'item-1'),
    link('keynote-slides', 'material', 'item-1'),
    link('workshop-slides', 'material', 'item-2'),
  ];

  it('separates the event’s own links from a session’s', () => {
    expect(eventMediaLinks(links).map((entry) => entry.id)).toEqual([
      'welcome',
    ]);
    expect(
      programItemMediaLinks(links, 'item-1').map((entry) => entry.id),
    ).toEqual(['keynote-recording', 'keynote-slides']);
  });

  it('answers with nothing for a session that has no links', () => {
    expect(programItemMediaLinks(links, 'item-3')).toEqual([]);
  });
});
