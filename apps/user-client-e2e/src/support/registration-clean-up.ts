import { asAdmin } from './series-fixtures';

/**
 * Removes registrations a browser test created.
 *
 * Needed because a confirmed registration blocks deleting its series (E14) —
 * which is the rule the suite proves, and which would otherwise leave the
 * seeded fixtures behind for good.
 */
export async function removeRegistrations(
  clientUrl: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;

  const context = await asAdmin(clientUrl);
  try {
    for (const id of ids) {
      await context.delete(`/api/admin/registrations/${id}`);
    }
  } finally {
    await context.dispose();
  }
}
