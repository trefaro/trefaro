import {
  formatEventPeriod,
  type TranslationCatalogue,
} from '@trefaro/shared-models';
import { interpolate } from '../common/interpolate';
import type {
  EventChangeNotice,
  MessageNotice,
  PushNotification,
} from './push-notification';

/**
 * The words of a notification, from the catalogue the organization maintains
 * (E22).
 *
 * The same source as the mails and the two clients, for the same reason: a
 * language this instance speaks must be a language it can *notify* in, and a
 * new one has to be addable without a deployment (chapter 4). What is
 * deliberately **not** taken over from mail is E24, the whole-letter fallback:
 * a notification is two lines, its per-key chain already ends in English
 * (E23), and a title in one language beside a body in another is a mixture
 * nobody would see for long enough to mind — whereas refusing to notify at all
 * would be a moved event nobody heard about.
 *
 * The texts avoid the second person on purpose. Every other German string in
 * this application had to choose between *du* (the mails) and *Sie* (the
 * screens); a notification is read on a lock screen with no idea which of the
 * two it belongs beside, and none of these six sentences needs a pronoun to
 * say what it says.
 */
export const PUSH_EVENT_TIME = 'push.event.time';
export const PUSH_EVENT_PLACE = 'push.event.place';
export const PUSH_EVENT_PLACE_CHANGED = 'push.event.placeChanged';
export const PUSH_EVENT_WITHDRAWN = 'push.event.withdrawn';
export const PUSH_MESSAGE_TITLE = 'push.message.title';
export const PUSH_MESSAGE_BODY = 'push.message.body';

/**
 * Every key a notification can ask for.
 *
 * Checked against the shipped English catalogue in `push-texts.spec.ts`, the
 * same net the mails have: a key a template asks for and the image does not
 * ship is a broken build, not a missing translation.
 */
export const ALL_PUSH_KEYS = [
  PUSH_EVENT_TIME,
  PUSH_EVENT_PLACE,
  PUSH_EVENT_PLACE_CHANGED,
  PUSH_EVENT_WITHDRAWN,
  PUSH_MESSAGE_TITLE,
  PUSH_MESSAGE_BODY,
] as const;

/**
 * What a changed event says, in one language.
 *
 * The **title is the event's own name**, untranslated: it is a proper noun,
 * and the notification's own icon and app name are already beside it on the
 * screen. The body is what changed.
 *
 * A withdrawn event says only that. It may have been moved in the same
 * request — an organizer fixing a date and archiving in one edit — and "the
 * new time is…" beside "this is not happening" is a notification that
 * contradicts itself.
 */
export function eventChangeNotification(
  catalogue: TranslationCatalogue,
  locale: string,
  notice: EventChangeNotice,
): PushNotification {
  const line = (key: string, params: Record<string, string> = {}) =>
    interpolate(catalogue[key] ?? key, params);

  const lines = notice.changes.includes('withdrawn')
    ? [line(PUSH_EVENT_WITHDRAWN)]
    : [
        ...(notice.changes.includes('time')
          ? [
              line(PUSH_EVENT_TIME, {
                period: formatEventPeriod(notice.period, locale),
              }),
            ]
          : []),
        ...(notice.changes.includes('place')
          ? [
              notice.place
                ? line(PUSH_EVENT_PLACE, { place: notice.place })
                : line(PUSH_EVENT_PLACE_CHANGED),
            ]
          : []),
      ];

  return {
    title: notice.name,
    // Two lines when both changed. A notification body may hold a line break;
    // joining with a space would produce "New time: … New place: …", which
    // reads as one sentence that has gone wrong.
    body: lines.join('\n'),
    url: notice.path,
  };
}

/** What a new message says — as little as it can (E44, NFR 7). */
export function messageNotification(
  catalogue: TranslationCatalogue,
  notice: MessageNotice,
): PushNotification {
  return {
    title: catalogue[PUSH_MESSAGE_TITLE] ?? PUSH_MESSAGE_TITLE,
    body: catalogue[PUSH_MESSAGE_BODY] ?? PUSH_MESSAGE_BODY,
    url: notice.path,
  };
}
