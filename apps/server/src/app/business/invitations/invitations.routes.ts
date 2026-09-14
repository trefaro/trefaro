/**
 * Where an objection is made, spelled once.
 *
 * Two routes lead to the same decision: a page in the participant client that
 * objects by `POST` (E5b, F58), and — since phase 5 — an endpoint a *mail
 * client* posts to on its own when the reader uses its unsubscribe button
 * (RFC 8058). The second one is written into a header of every invitation, so
 * the string the controller answers on and the string the letter carries must
 * be the same string; two spellings would produce a header that 404s and
 * nobody would notice until a mail provider did.
 *
 * In its own file so the sender can read it without importing a controller.
 */

/** The controller's own path, under the server's `/api` prefix. */
export const INVITATION_OPT_OUT_ROUTE = 'user/invitations/opt-out';

/** The route inside it that accepts a bare one-click POST. */
export const ONE_CLICK_SEGMENT = 'one-click';

/**
 * The absolute path of the one-click endpoint, `/api` included.
 *
 * What goes into `List-Unsubscribe`. Absolute because a mail client has no
 * base to resolve anything against.
 */
export const INVITATION_ONE_CLICK_PATH = `/api/${INVITATION_OPT_OUT_ROUTE}/${ONE_CLICK_SEGMENT}`;

/**
 * The form field RFC 8058 requires in the body, and its value.
 *
 * Required rather than ignored — see the endpoint for why: it is the one part
 * of the request that a link previewer following its nose would not send.
 */
export const ONE_CLICK_FIELD = 'List-Unsubscribe';
export const ONE_CLICK_VALUE = 'One-Click';
