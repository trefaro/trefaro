import { request } from '@playwright/test';
import { ADMIN_STORAGE_STATE, SERIES_SLUG_PREFIX } from './admin-session';

const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4300';

interface AdminSeries {
  id: string;
  slug: string;
}

interface AdminEvent {
  id: string;
}

/** Through the participant overview AP 5 added — one page is plenty here. */
async function removeRegistrationsOf(
  context: Awaited<ReturnType<typeof request.newContext>>,
  seriesId: string,
): Promise<void> {
  const response = await context.get(`/api/admin/series/${seriesId}/events`);
  if (!response.ok()) return;

  const events: AdminEvent[] = await response.json();
  for (const event of events) {
    const listed = await context.get(
      `/api/admin/events/${event.id}/registrations?pageSize=200`,
    );
    if (!listed.ok()) continue;
    const { rows = [] } = (await listed.json()) as { rows?: { id: string }[] };
    for (const row of rows) {
      await context.delete(`/api/admin/registrations/${row.id}`);
    }
  }
}

/**
 * Removes the event series the suite created.
 *
 * The tests delete their own series, so this only ever finds something after a
 * failed run — and that is exactly the case worth covering: a leftover row made
 * the *next* run fail for a different reason, which is how a real defect gets
 * buried under noise.
 *
 * Reuses the session from the global setup rather than logging in again; the
 * login is rate limited per address.
 */
export default async function globalTeardown(): Promise<void> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const response = await context.get('/api/admin/series');
    if (!response.ok()) return;

    const series: AdminSeries[] = await response.json();
    for (const item of series) {
      if (!item.slug.startsWith(SERIES_SLUG_PREFIX)) continue;
      // Registrations first: a confirmed one blocks deleting the series (E14),
      // so a series seeded with participants would otherwise stay for good.
      await removeRegistrationsOf(context, item.id);
      await context.delete(`/api/admin/series/${item.id}`);
    }
  } finally {
    await context.dispose();
  }
}
