import { expect, test, type APIRequestContext } from '@playwright/test';
import { optOutPathFrom, waitForMailTo } from './support/mail';
import {
  closeSeedDatabase,
  seedConfirmedRegistration,
} from './support/registration-seed';
import { asAdmin } from './support/series-fixtures';

/**
 * Objecting to further invitations, in a browser (FR 2.4, E15) — AP 12.
 *
 * The acceptance criterion of AP 12 from the participant's side, and the reason
 * writing to former participants is legitimate at all: the link in the mail
 * works, one click ends it, and the address is then in no list an organizer can
 * see.
 *
 * The link is read out of Mailpit rather than minted here. That is the point —
 * what could quietly not work is not the endpoint but the link *leaving the
 * server* and pointing at a page that exists.
 *
 * Each engine seeds its own series with one event and one participant: the
 * objection is instance-wide (F57), so a shared fixture would let the first
 * engine to finish take the address away from the other two.
 *
 * One administrative context for the whole file, opened once and reused, and the
 * participant is seeded rather than registered. Both for the same reason: in CI
 * all three e2e projects run against one server, and the login and the public
 * registration form each allow a fixed number of attempts per five minutes and
 * client address (E4). Spending those on a fixture makes an unrelated spec fail
 * with a 429 — which is what the first CI run of AP 12 did. What is under test
 * here is the objection link, not the double opt-in.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A label that is unique across every worker of a run, without a clock.
 *
 * Not `Date.now()`: a worker is a process, and two of them seeding in the same
 * millisecond collide on the unique slug index — a failure that reads like a
 * broken fixture and shows up about one run in twenty.
 */
let sequence = 0;

function fixtureLabel(engine: string): string {
  sequence += 1;
  return `${engine}-${process.pid}-${sequence}`;
}

interface Created {
  id: string;
  slug: string;
}

interface Contact {
  registrationId: string;
  email: string;
}

interface Invitation {
  id: string;
  state: string;
  sent: number;
}

interface Invited {
  readonly seriesId: string;
  readonly eventId: string;
  readonly email: string;
  readonly optOutPath: string;
  readonly contacts: () => Promise<readonly Contact[]>;
}

/**
 * A confirmed participant who has just been invited, and their objection link.
 *
 * The series and the event go through the administrative API — the same path an
 * organizer takes — and the registration is seeded (see
 * `support/registration-seed.ts` for why). Then that one person is invited, and
 * the objection link is taken out of the message that actually arrived.
 */
async function invite(
  admin: APIRequestContext,
  label: string,
): Promise<Invited> {
  const series: Created = await (
    await admin.post('/api/admin/series', {
      data: {
        name: `E2E Series Invitation Objection ${label}`,
        description: 'Holds the event whose participant objects.',
        status: 'published',
      },
    })
  ).json();

  const event: Created = await (
    await admin.post(`/api/admin/series/${series.id}/events`, {
      data: {
        name: `Objection Event ${label}`,
        description: 'The event the invitation refers back to.',
        eventType: 'onsite',
        startsAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        endsAt: new Date(Date.now() + 31 * DAY_MS).toISOString(),
        timezone: 'Europe/Berlin',
        venueName: 'E2E Bürgerhaus Kalk',
        languages: ['de'],
        status: 'published',
      },
    })
  ).json();

  const email = `objector-${label}@e2e.example.org`.toLowerCase();
  await seedConfirmedRegistration(event.id, {
    email,
    firstName: 'Ola',
    lastName: 'Objector',
  });

  const contacts = async (): Promise<readonly Contact[]> => {
    const { rows = [] } = (await (
      await admin.get(`/api/admin/series/${series.id}/contacts?pageSize=200`)
    ).json()) as { rows?: Contact[] };
    return rows;
  };

  const audience = await contacts();
  expect(audience.map((row) => row.email)).toContain(email);

  const subject = `Invitation ${label}`;
  const accepted = await admin.post(
    `/api/admin/series/${series.id}/invitations`,
    {
      data: {
        subject,
        body: 'we would love to see you again.',
        recipients: audience.map((row) => row.registrationId),
      },
    },
  );
  expect(`${accepted.status()} ${await accepted.text()}`).toMatch(/^202/);
  const { id } = (await accepted.json()) as Invitation;

  // The mails follow the answer (F56), so wait for the send to be over rather
  // than for the message that may not be there yet.
  const deadline = Date.now() + 60_000;
  for (;;) {
    const invitation = (await (
      await admin.get(`/api/admin/invitations/${id}`)
    ).json()) as Invitation;
    if (invitation.state !== 'sending') {
      expect(invitation.sent).toBe(audience.length);
      break;
    }
    if (Date.now() > deadline)
      throw new Error(`Invitation ${id} never finished`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const invitation = await waitForMailTo(email, {
    subject: new RegExp(label),
  });
  expect(invitation.subject).toBe(subject);

  return {
    seriesId: series.id,
    eventId: event.id,
    email,
    optOutPath: optOutPathFrom(invitation),
    contacts,
  };
}

test.describe('objecting to further invitations', () => {
  let admin: APIRequestContext;
  let invited: Invited | null = null;

  test.beforeAll(async () => {
    admin = await asAdmin(CLIENT_URL);
  });

  test.afterAll(async () => {
    await admin.dispose();
    await closeSeedDatabase();
  });

  // The registration first, then the series: a confirmed registration blocks
  // deleting the series it belongs to (E14) — which is the rule, not a bug.
  test.afterEach(async () => {
    if (!invited) return;
    const { rows = [] } = (await (
      await admin.get(
        `/api/admin/events/${invited.eventId}/registrations?search=${encodeURIComponent(invited.email)}`,
      )
    ).json()) as { rows?: { id: string }[] };
    for (const row of rows) {
      await admin.delete(`/api/admin/registrations/${row.id}`);
    }
    await admin.delete(`/api/admin/series/${invited.seriesId}`);
    invited = null;
  });

  test('takes one click, and then the address is in no list', async ({
    page,
    browserName,
  }) => {
    invited = await invite(admin, fixtureLabel(browserName));

    await page.goto(invited.optOutPath);

    // Nothing has happened yet: the page objects by POST, so a link previewer
    // that fetched this URL would have decided nothing (E5b).
    expect((await invited.contacts()).map((row) => row.email)).toContain(
      invited.email,
    );

    await page.getByRole('button', { name: 'Do not invite me again' }).click();

    await expect(
      page.getByRole('heading', { name: 'You will not be invited again' }),
    ).toBeVisible();
    // The criterion of AP 12, seen from outside: no list an organizer can ask
    // for contains this address any more.
    expect((await invited.contacts()).map((row) => row.email)).not.toContain(
      invited.email,
    );
  });

  test('says what is not affected by the objection (F59)', async ({
    page,
    browserName,
  }) => {
    invited = await invite(admin, fixtureLabel(browserName));

    await page.goto(invited.optOutPath);
    await page.getByRole('button', { name: 'Do not invite me again' }).click();

    // Transactional mail keeps working: somebody who does not want invitations
    // still has to learn that their registration was cancelled.
    await expect(
      page.getByText(/confirmation, or a cancellation/),
    ).toBeVisible();
  });

  test('asks for the whole link when the token is missing', async ({
    page,
  }) => {
    await page.goto('/invitations/unsubscribe');

    await expect(page.getByRole('alert')).toContainText('missing its token');
    await expect(page.getByRole('button')).toHaveCount(0);
  });
});
