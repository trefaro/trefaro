import { request } from '@playwright/test';

/**
 * Event series the participant client's tests need to exist.
 *
 * Seeded through the administrative API rather than through SQL: the seed then
 * exercises the same rules a real organizer does, and a schema change cannot
 * leave the fixture behind. Removed again in the global teardown so a
 * developer's instance does not slowly fill with test data.
 */
export const PUBLISHED_SERIES = {
  slug: 'e2e-published-series',
  name: 'E2E Published Series',
  description: 'Visible to participants because it is published.',
  status: 'published',
} as const;

export const DRAFT_SERIES = {
  slug: 'e2e-draft-series',
  name: 'E2E Draft Series',
  description: 'Must never appear on the public start page.',
  status: 'draft',
} as const;

const FIXTURES = [PUBLISHED_SERIES, DRAFT_SERIES];

interface AdminSeries {
  id: string;
  slug: string;
}

function credentials(): { email: string; password: string } {
  const email = process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '';
  const password = process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '';
  if (!email || !password) {
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set so the ' +
        'participant client suite can seed the event series it asserts on. ' +
        'Add them to .env.',
    );
  }
  return { email, password };
}

/**
 * One logged-in API context, reused for every seed call.
 *
 * The login is rate limited per address and the whole suite shares one, so this
 * happens once per run.
 */
async function asAdmin(clientUrl: string) {
  const context = await request.newContext({ baseURL: clientUrl });
  const login = await context.post('/api/admin/auth/login', {
    data: credentials(),
  });
  if (!login.ok()) {
    await context.dispose();
    throw new Error(
      `Signing in to seed the event series failed with status ${login.status()}.`,
    );
  }
  return context;
}

export async function seedSeries(clientUrl: string): Promise<void> {
  const context = await asAdmin(clientUrl);
  try {
    const existing: AdminSeries[] = await (
      await context.get('/api/admin/series')
    ).json();

    for (const fixture of FIXTURES) {
      const match = existing.find((series) => series.slug === fixture.slug);
      // Idempotent: a leftover from an interrupted run is brought back into
      // shape rather than duplicated under a numbered address.
      if (match) {
        await context.patch(`/api/admin/series/${match.id}`, {
          data: fixture,
        });
      } else {
        await context.post('/api/admin/series', { data: fixture });
      }
    }
  } finally {
    await context.dispose();
  }
}

export async function removeSeededSeries(clientUrl: string): Promise<void> {
  const context = await asAdmin(clientUrl);
  try {
    const existing: AdminSeries[] = await (
      await context.get('/api/admin/series')
    ).json();

    for (const fixture of FIXTURES) {
      const match = existing.find((series) => series.slug === fixture.slug);
      if (match) await context.delete(`/api/admin/series/${match.id}`);
    }
  } finally {
    await context.dispose();
  }
}
