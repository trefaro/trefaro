import type { EventType } from '@trefaro/shared-models';

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
