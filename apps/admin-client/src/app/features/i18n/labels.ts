import type { EventType, RegistrationFieldType } from '@trefaro/shared-models';

/**
 * The organizer's word for an event's format.
 *
 * Not in `shared-models` beside {@link EVENT_TYPES}, and deliberately not the
 * participant client's `event.onSite…` keys: that client says "On site and
 * online" to somebody deciding whether to travel, while this one says "Hybrid"
 * in a table column headed "Type". Two audiences, two vocabularies — one shared
 * key would force them together.
 */
export function eventTypeKey(type: EventType): string {
  return `admin.eventType.${type}`;
}

/**
 * The organizer's word for a kind of answer.
 *
 * One function for both field kits (F83, F138). The word is a *stored* value —
 * `text`, `select`, `checkbox`, `file` — so two screens naming it would be two
 * vocabularies for one thing, and a rewording would reach only one of them. The
 * registration form has all four types, the profile form the first three
 * (F37): the same words, a shorter list.
 *
 * Here rather than in `shared-models` beside {@link REGISTRATION_FIELD_TYPES},
 * although F83 puts a stored word's key function there: these keys are
 * `admin.*`, the organizer client's own namespace (F82), and `shared-models` is
 * imported by the server as well — a server that owns interface words owns them
 * in one language.
 */
export function fieldTypeKey(type: RegistrationFieldType): string {
  return `admin.fields.type.${type}`;
}
