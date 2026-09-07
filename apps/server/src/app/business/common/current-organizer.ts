/**
 * Where the authenticated administrator is parked for the request (E16).
 *
 * The counterpart of `current-participant.ts`, and deliberately a second file
 * rather than one shared abstraction: an organizer's session and a
 * participant's must never share a type, because a guard that could read either
 * would be a guard that can confuse them (the reasoning `ResolvedSession`
 * spells out). Two properties, two readers, no way to mistake one for the
 * other.
 *
 * In `business/common/` because two readers need it (F100): `AdminGuard` writes
 * it after resolving the administrative cookie, and the plug-in contract reads
 * it so a plug-in can record **who decided** without importing the module that
 * owns organizer accounts.
 */
export const CURRENT_ADMIN_PROPERTY = 'trefaroAdmin';

/** As much of the parked administrator as a reader outside `login` may know. */
interface ParkedAdmin {
  readonly admin: { readonly id: string };
}

/**
 * Which organizer is behind this request, or `null` when none is.
 *
 * Structural, and an id only: a name, an address and a role are the login
 * module's business. What a caller outside it needs is the foreign key it has
 * to store.
 */
export function currentOrganizerId(request: unknown): string | null {
  if (typeof request !== 'object' || request === null) return null;
  const parked = (request as Record<string, unknown>)[
    CURRENT_ADMIN_PROPERTY
  ] as ParkedAdmin | undefined;
  const id = parked?.admin?.id;
  return typeof id === 'string' && id !== '' ? id : null;
}
