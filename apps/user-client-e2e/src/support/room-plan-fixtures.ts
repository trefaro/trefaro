import type { APIRequestContext } from '@playwright/test';

/**
 * A published event with two sessions in one room and an empty second room
 * (FR 3.6) — AP 6 of phase 4.
 *
 * Everything through the administrative API and the plug-in's own routes:
 * the rooms and the assignments are what an organizer makes, and the suite
 * that makes them in a browser is the organizer client's. A series of its own
 * rather than the shared fixture event, because one session gets a German
 * title here (FR 3.12) and the shared programme is read by suites that expect
 * its titles as they are.
 *
 * The plug-in has to be **on** before the rooms are made — its routes answer
 * 404 otherwise — so the caller switches it on first.
 */
export interface SeededRoomPlan {
  readonly seriesId: string;
  readonly seriesSlug: string;
  readonly eventSlug: string;
  readonly eventId: string;
  readonly plenaryTitle: string;
  readonly plenaryTitleDe: string;
  readonly panelTitle: string;
}

interface Created {
  id: string;
  slug: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedRoomPlan(
  admin: APIRequestContext,
  label: string,
): Promise<SeededRoomPlan> {
  const series: Created = await (
    await admin.post('/api/admin/series', {
      data: {
        name: `E2E rooms ${label}`,
        description: 'Holds the event whose room plan a participant reads.',
        status: 'published',
      },
    })
  ).json();

  const day = new Date(Date.now() + 45 * DAY_MS);
  day.setUTCHours(0, 0, 0, 0);
  const at = (hours: number): string =>
    new Date(day.getTime() + hours * 60 * 60 * 1000).toISOString();

  const event: Created = await (
    await admin.post(`/api/admin/series/${series.id}/events`, {
      data: {
        name: `E2E Rooms Event ${label}`,
        description: 'On site, with a room plan.',
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

  const session = async (
    title: string,
    from: number,
    to: number,
  ): Promise<string> => {
    const created: Created = await (
      await admin.post(`/api/admin/events/${event.id}/program-items`, {
        data: { title, startsAt: at(from), endsAt: at(to) },
      })
    ).json();
    return created.id;
  };
  const plenaryTitle = `E2E Opening plenary ${label}`;
  const plenaryTitleDe = `E2E Eröffnungsplenum ${label}`;
  const panelTitle = `E2E Panel ${label}`;
  const plenary = await session(plenaryTitle, 9, 10);
  const panel = await session(panelTitle, 11, 12);
  await admin.put(`/api/admin/program-items/${plenary}/translations/de`, {
    data: { title: plenaryTitleDe, description: null },
  });

  const room = async (name: string, capacity: number, floor?: string) => {
    const created: Created = await (
      await admin.post(
        `/api/admin/plugins/room-planning/events/${event.id}/rooms`,
        { data: { name, capacity, ...(floor ? { floor } : {}) } },
      )
    ).json();
    return created.id;
  };
  const saalA = await room('Saal A', 40, 'Ground floor');
  await room('Raum B', 20);
  for (const item of [plenary, panel]) {
    await admin.put(
      `/api/admin/plugins/room-planning/program-items/${item}/rooms/${saalA}`,
    );
  }

  return {
    seriesId: series.id,
    seriesSlug: series.slug,
    eventSlug: event.slug,
    eventId: event.id,
    plenaryTitle,
    plenaryTitleDe,
    panelTitle,
  };
}

/** The series goes, and with it the event, its sessions and — through the plug-in's own foreign keys (F21) — its rooms. */
export async function removeRoomPlan(
  admin: APIRequestContext,
  seeded: SeededRoomPlan,
): Promise<void> {
  await admin.delete(`/api/admin/series/${seeded.seriesId}`);
}
