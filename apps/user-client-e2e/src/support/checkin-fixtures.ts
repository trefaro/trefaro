import type { APIRequestContext } from '@playwright/test';

/**
 * A published event of this suite's own, to check people in at — AP 8 of
 * phase 4.
 *
 * Its own series rather than the shared fixture event, and for a reason this
 * plug-in has more of than the others: the admission list is **every confirmed
 * registration of one event**, so a shared event would put whatever the other
 * suites registered into the list under test — and three browser engines
 * register against one instance (E10).
 *
 * No custom fields, so a registration through the public form is one JSON body
 * and one mail rather than a multipart with a file in it (E9): what this suite
 * is about starts after the receipt.
 */
export interface SeededCheckinEvent {
  readonly seriesId: string;
  readonly seriesSlug: string;
  readonly eventSlug: string;
  readonly eventId: string;
}

interface Created {
  id: string;
  slug: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedCheckinEvent(
  admin: APIRequestContext,
  label: string,
): Promise<SeededCheckinEvent> {
  const series: Created = await (
    await admin.post('/api/admin/series', {
      data: {
        name: `E2E check-in ${label}`,
        description: 'Holds the event whose door this suite stands at.',
        status: 'published',
      },
    })
  ).json();

  const day = new Date(Date.now() + 40 * DAY_MS);
  day.setUTCHours(0, 0, 0, 0);
  const at = (hours: number): string =>
    new Date(day.getTime() + hours * 60 * 60 * 1000).toISOString();

  const event: Created = await (
    await admin.post(`/api/admin/series/${series.id}/events`, {
      data: {
        name: `E2E Check-in Event ${label}`,
        description: 'On site, with somebody at the door.',
        eventType: 'onsite',
        startsAt: at(6),
        endsAt: at(16),
        timezone: 'Europe/Berlin',
        venueName: 'E2E Bürgerhaus Kalk',
        languages: ['de', 'en'],
        status: 'published',
      },
    })
  ).json();

  return {
    seriesId: series.id,
    seriesSlug: series.slug,
    eventSlug: event.slug,
    eventId: event.id,
  };
}

/**
 * The series goes, and with it the event and its sessions.
 *
 * The registrations have to be gone first — `deleteRegistrationsOfEvent` —
 * because an organizer may not delete a series that has confirmed
 * registrations under it (E14), and this fixture makes two.
 */
export async function removeCheckinEvent(
  admin: APIRequestContext,
  seeded: SeededCheckinEvent,
): Promise<void> {
  await admin.delete(`/api/admin/series/${seeded.seriesId}`);
}
