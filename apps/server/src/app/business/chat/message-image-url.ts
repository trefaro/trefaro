import { MEDIA_URL_PREFIX } from '../config';

/**
 * The URL of the picture in a message (FR 4.5 — E40).
 *
 * A pure function like `avatar-url.ts` and `logo-url.ts`, and it keeps the two
 * properties those argue for — no stored path in the address, one place where
 * the address is built — while breaking with them on a third:
 *
 * - **It is addressed by the message, not by the file.** Every other media
 *   route names the row that owns the bytes; here the owning row is an
 *   `attachment`, and an attachment id says nothing about who may see it.
 *   Membership is a property of the conversation the **message** is in, so the
 *   message is what the route resolves.
 * - **There is no `?v=`.** An avatar can be replaced, so its URL carries the
 *   row's timestamp to keep aggressive caching honest. A message cannot be
 *   edited (E14): its picture is the one it was sent with, forever, and a
 *   version parameter would be a promise that something could change.
 *
 * This is also the one media route of this application that checks a
 * permission, and the difference from F115 is what a picture *is* here: a logo
 * is a mark and an avatar is handed out with an id its reader may already see,
 * whereas this is content inside a private conversation.
 */

/** `false` in, `null` out: a message without a picture has no address for one. */
export function messageImageUrl(
  messageId: string,
  hasImage: boolean,
): string | null {
  if (!hasImage) return null;
  return `${MEDIA_URL_PREFIX}/messages/${messageId}/attachment`;
}
