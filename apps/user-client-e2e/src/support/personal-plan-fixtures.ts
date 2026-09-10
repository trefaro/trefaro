import type { APIRequestContext } from '@playwright/test';

/**
 * A published event with three sessions on two days (FR 3.17) — AP 9 of
 * phase 4.
 *
 * Everything through the administrative API, because that is how a programme
 * comes into being. A series of its own rather than the shared fixture event,
 * for the reason the room plan has one: a session here carries a German title
 * (FR 3.12), and the shared programme is read by suites that expect its titles
 * as they are.
 *
 * The three sessions are the three shapes F42 allows, and the section has to
 * tell them apart: one that asks nothing, one that asks with a limit, and one
 * that asks without one. The second day exists so the day headings have
 * something to separate.
 *
 * No registrations and no sign-ups: this fixture's whole point is that the
 * seat count stays at zero however often the plan is ticked (E55).
 */
export interface SeededPersonalPlan {
  readonly seriesId: string;
  readonly seriesSlug: string;
  readonly eventSlug: string;
  readonly eventId: string;
  readonly plenaryId: string;
  readonly workshopId: string;
  readonly plenaryTitle: string;
  readonly plenaryTitleDe: string;
  readonly workshopTitle: string;
  readonly openSpaceTitle: string;
}

interface Created {
  id: string;
  slug: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedPersonalPlan(
  admin: APIRequestContext,
  label: string,
): Promise<SeededPersonalPlan> {
  const series: Created = await (
    await admin.post('/api/admin/series', {
      data: {
        name: `E2E personal plan ${label}`,
        description: 'Holds the event whose programme a participant ticks.',
        status: 'published',
      },
    })
  ).json();

  const day = new Date(Date.now() + 50 * DAY_MS);
  day.setUTCHours(0, 0, 0, 0);
  const at = (hours: number): string =>
    new Date(day.getTime() + hours * 60 * 60 * 1000).toISOString();

  const event: Created = await (
    await admin.post(`/api/admin/series/${series.id}/events`, {
      data: {
        name: `E2E Personal Plan Event ${label}`,
        description: 'Two days, three sessions, nobody signed up.',
        eventType: 'onsite',
        startsAt: at(6),
        endsAt: at(40),
        timezone: 'Europe/Berlin',
        venueName: 'E2E Bürgerhaus Kalk',
        languages: ['de', 'en'],
        status: 'published',
      },
    })
  ).json();

  const session = async (
    title: string,
    from: number,
    to: number,
    seats?: { capacity?: number },
  ): Promise<string> => {
    const created: Created = await (
      await admin.post(`/api/admin/events/${event.id}/program-items`, {
        data: {
          title,
          startsAt: at(from),
          endsAt: at(to),
          ...(seats
            ? {
                registrationEnabled: true,
                ...(seats.capacity ? { capacity: seats.capacity } : {}),
              }
            : {}),
        },
      })
    ).json();
    return created.id;
  };

  const plenaryTitle = `E2E Opening plenary ${label}`;
  const plenaryTitleDe = `E2E Eröffnungsplenum ${label}`;
  const workshopTitle = `E2E Workshop with seats ${label}`;
  const openSpaceTitle = `E2E Open space ${label}`;

  // Day one: a plenary that asks nothing, a workshop with twelve seats.
  const plenaryId = await session(plenaryTitle, 9, 10);
  const workshopId = await session(workshopTitle, 11, 13, { capacity: 12 });
  // Day two: a sign-up without a limit — the shape a capacity alone cannot
  // tell from a session that asks nothing (F42).
  await session(openSpaceTitle, 33, 34, {});

  await admin.put(`/api/admin/program-items/${plenaryId}/translations/de`, {
    data: { title: plenaryTitleDe, description: null },
  });

  return {
    seriesId: series.id,
    seriesSlug: series.slug,
    eventSlug: event.slug,
    eventId: event.id,
    plenaryId,
    workshopId,
    plenaryTitle,
    plenaryTitleDe,
    workshopTitle,
    openSpaceTitle,
  };
}

/**
 * The series goes, and with it the event, its sessions and — through the
 * plug-in's own foreign key (F21) — everybody's plan rows.
 *
 * Nothing to delete first: this fixture creates no registrations, which is why
 * the 409 the check-in's fixture ran into cannot happen here.
 */
export async function removePersonalPlan(
  admin: APIRequestContext,
  seeded: SeededPersonalPlan,
): Promise<void> {
  await admin.delete(`/api/admin/series/${seeded.seriesId}`);
}
