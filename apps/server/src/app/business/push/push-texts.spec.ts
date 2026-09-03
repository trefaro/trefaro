import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TranslationCatalogue } from '@trefaro/shared-models';
import type { EventChangeNotice } from './push-notification';
import {
  ALL_PUSH_KEYS,
  eventChangeNotification,
  messageNotification,
} from './push-texts';

/**
 * The two notifications, rendered out of the catalogues this image ships.
 *
 * Against the files rather than a fixture, for the reason `mails.spec.ts`
 * gives: the text is data (E22), so what used to be a compile error has to be
 * a test — and a test with its own little catalogue would say nothing about
 * what reaches a phone.
 *
 * Found by walking up from the working directory, because Nx runs Jest from
 * the project's directory and Vitest from the workspace root.
 */
const CATALOGUE_DIR = locateCatalogues();

function locateCatalogues(): string {
  let directory = process.cwd();
  for (;;) {
    const candidate = join(directory, 'libs', 'shared-i18n', 'catalogues');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error('cannot find libs/shared-i18n/catalogues above the cwd');
    }
    directory = parent;
  }
}

function shipped(locale: string): TranslationCatalogue {
  return JSON.parse(
    readFileSync(join(CATALOGUE_DIR, `${locale}.json`), 'utf8'),
  ) as TranslationCatalogue;
}

const english = shipped('en');
const german = shipped('de');

const notice = (
  overrides: Partial<EventChangeNotice> = {},
): EventChangeNotice => ({
  eventId: 'event-1',
  name: 'Bürgerrat Köln',
  path: '/series/buergerraete/events/koeln',
  changes: ['time'],
  period: {
    startsAt: '2026-10-01T16:00:00.000Z',
    endsAt: '2026-10-01T18:00:00.000Z',
    timezone: 'Europe/Berlin',
  },
  place: 'Bürgerhaus Kalk',
  ...overrides,
});

describe('the words of a notification', () => {
  it('ships every key a notification can ask for, in both languages', () => {
    for (const key of ALL_PUSH_KEYS) {
      expect(typeof english[key]).toBe('string');
      // German too, although E23 would fall back per key: the shipped
      // languages are the two an instance starts with, and a German
      // notification with an English line in it is the mixture the mails have
      // a whole rule about (E24).
      expect(typeof german[key]).toBe('string');
    }
  });

  it('titles a changed event with its own name and links to its page', () => {
    const rendered = eventChangeNotification(english, 'en', notice());

    expect(rendered.title).toBe('Bürgerrat Köln');
    expect(rendered.url).toBe('/series/buergerraete/events/koeln');
  });

  it('spells the new time out in the event’s zone and the reader’s language', () => {
    const rendered = eventChangeNotification(english, 'en', notice());
    const auf = eventChangeNotification(german, 'de', notice());

    // 18:00 in Berlin, not 16:00 UTC (E8) — an event's times belong to the
    // event's own clock.
    expect(rendered.body).toContain('18:00');
    expect(rendered.body).toContain('October');
    expect(auf.body).toContain('Oktober');
  });

  it('names the new place when there is one to name', () => {
    const rendered = eventChangeNotification(
      english,
      'en',
      notice({ changes: ['place'] }),
    );

    expect(rendered.body).toContain('Bürgerhaus Kalk');
  });

  it('says only that the place changed for an event with no venue', () => {
    const rendered = eventChangeNotification(
      english,
      'en',
      notice({ changes: ['place'], place: null }),
    );

    expect(rendered.body).toBe(english['push.event.placeChanged']);
  });

  it('puts a new time and a new place on two lines', () => {
    const rendered = eventChangeNotification(
      english,
      'en',
      notice({ changes: ['time', 'place'] }),
    );

    expect(rendered.body.split('\n')).toHaveLength(2);
  });

  it('says only that a withdrawn event is off', () => {
    const rendered = eventChangeNotification(
      english,
      'en',
      notice({ changes: ['withdrawn', 'time', 'place'] }),
    );

    expect(rendered.body).toBe(english['push.event.withdrawn']);
  });

  it('leaves no placeholder unfilled in either language', () => {
    for (const [catalogue, locale] of [
      [english, 'en'],
      [german, 'de'],
    ] as const) {
      const rendered = eventChangeNotification(
        catalogue,
        locale,
        notice({ changes: ['time', 'place'] }),
      );
      // A visible `{{period}}` is what an unfilled parameter looks like on a
      // lock screen, and the interpolation leaves it on purpose (see
      // `interpolate`) — so the templates have to supply what they ask for.
      expect(rendered.body).not.toContain('{{');
    }
  });

  it('carries no sender and no text in a message notification (NFR 7, E44)', () => {
    const rendered = messageNotification(english, { path: '/messages/c-1' });

    expect(rendered).toEqual({
      title: english['push.message.title'],
      body: english['push.message.body'],
      url: '/messages/c-1',
    });
  });
});
