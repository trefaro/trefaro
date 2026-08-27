import { asAdmin } from './series-fixtures';

interface AdminSeries {
  id: string;
  slug: string;
}

interface AdminEvent {
  id: string;
  slug: string;
}

/**
 * Removes registrations a browser test created.
 *
 * Needed because a confirmed registration blocks deleting its series (E14) —
 * which is the rule the suite proves, and which would otherwise leave the
 * seeded fixtures behind for good.
 *
 * Addressed by e-mail rather than by id: until AP 5 this suite read the id out
 * of the confirmation token's payload, which is legible because the token is
 * signed rather than encrypted (E5). The participant overview replaced that with
 * a proper lookup — `GET /api/admin/events/:id/registrations?search=…`.
 */
export async function removeRegistrations(
  clientUrl: string,
  emails: readonly string[],
): Promise<void> {
  if (emails.length === 0) return;

  const context = await asAdmin(clientUrl);
  try {
    const eventIds = await seededEventIds(context);

    for (const email of emails) {
      for (const eventId of eventIds) {
        const response = await context.get(
          `/api/admin/events/${eventId}/registrations?search=${encodeURIComponent(email)}`,
        );
        if (!response.ok()) continue;
        const { rows = [] } = (await response.json()) as {
          rows?: { id: string }[];
        };
        for (const row of rows) {
          await context.delete(`/api/admin/registrations/${row.id}`);
        }
      }
    }
  } finally {
    await context.dispose();
  }
}

/** Every event of the series this suite seeds — a registration can only be on one. */
async function seededEventIds(
  context: Awaited<ReturnType<typeof asAdmin>>,
): Promise<readonly string[]> {
  const listed = await context.get('/api/admin/series');
  if (!listed.ok()) return [];
  const series = (await listed.json()) as AdminSeries[];

  const ids: string[] = [];
  for (const item of series.filter((entry) => entry.slug.startsWith('e2e-'))) {
    // A series may be gone between the listing and this call: since AP 12 the
    // invitation suite creates and deletes one per test, in parallel with this.
    // A 404 answers with an object, and `.map` on it fails in the teardown of a
    // test that had nothing to do with it.
    const response = await context.get(`/api/admin/series/${item.id}/events`);
    if (!response.ok()) continue;
    const events = (await response.json()) as AdminEvent[];
    if (!Array.isArray(events)) continue;
    ids.push(...events.map((event) => event.id));
  }
  return ids;
}
