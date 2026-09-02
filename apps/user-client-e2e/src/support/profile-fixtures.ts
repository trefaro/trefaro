import { asAdmin } from './series-fixtures';

/**
 * One extra profile question, for the browser suite that fills it in (E35).
 *
 * Seeded and removed per test rather than in the global setup, and optional
 * rather than required — both on purpose. The profile field kit is
 * **instance-wide**: it hangs off no event, so a question this suite leaves
 * behind is asked of everybody, and a *required* one would make every other
 * suite's profile update fail with a 400 about a question they never saw. Three
 * browser engines also run this suite at the same time against one instance, so
 * each engine seeds its own key and asserts only on its own label.
 *
 * Through the administrative API, like the series fixtures: the seed then goes
 * through the same rules an organizer does, and a schema change cannot leave it
 * behind.
 */
export interface SeededProfileField {
  readonly id: string;
  readonly key: string;
  readonly label: string;
}

export async function seedProfileField(
  clientUrl: string,
  field: { key: string; label: string; helpText?: string },
): Promise<SeededProfileField> {
  const context = await asAdmin(clientUrl);
  try {
    const created = await context.post('/api/admin/profile-fields', {
      data: {
        key: field.key,
        label: field.label,
        type: 'text',
        helpText: field.helpText ?? null,
        // Never required — see the note above.
        required: false,
      },
    });
    if (!created.ok()) {
      throw new Error(
        `Seeding the profile question failed with ${created.status()}: ` +
          (await created.text()),
      );
    }
    const { id } = (await created.json()) as { id: string };
    return { id, key: field.key, label: field.label };
  } finally {
    await context.dispose();
  }
}

/** Removes it again. A 404 is not a failure — the cleanup may run twice. */
export async function removeProfileField(
  clientUrl: string,
  id: string,
): Promise<void> {
  const context = await asAdmin(clientUrl);
  try {
    await context.delete(`/api/admin/profile-fields/${id}`);
  } finally {
    await context.dispose();
  }
}
