import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  GUEST,
  MEMBERS,
  WITHOUT_ACCOUNT,
  addressOf,
  closeMessagesDatabase,
  removeMessages,
  seedMessages,
  type SeededMessages,
} from './support/messages-fixtures';

/**
 * The organization's messages in the browser (FR 3.4, UC 14) — AP 10.
 *
 * The acceptance criterion of the package as one walk: a question from
 * somebody with no account is found in the overview, answered, and the answer
 * stands in the history with a sentence saying where it went — then a group of
 * three registrants is assembled and lands in its own thread.
 *
 * **What this suite does not read is the mailbox.** That the answer really
 * reaches Mailpit is decided in `apps/server-e2e`, against the mail server
 * itself; what only a browser can decide is whether the screen says so — and
 * the sentence it says is drawn from the server's own `delivery`, so a mail
 * that never left cannot produce it (F174).
 *
 * Each engine seeds its own series, event, people and question, because three
 * of them run this spec against one instance.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe('the organization’s messages', () => {
  let seeded: SeededMessages;

  test.beforeAll(async () => {
    seeded = await seedMessages(fixtureLabel(test.info().project.name));
  });

  test.afterAll(async () => {
    if (seeded) await removeMessages(seeded);
    await closeMessagesDatabase();
  });

  test('answers a question from somebody without an account', async ({
    page,
  }) => {
    await page.goto('/messages');

    await expect(
      page.getByRole('heading', { name: t('admin.messages.title') }),
    ).toBeVisible();

    // The row: who asked, that nobody has answered yet, and the first line of
    // what they wrote — the three things a mail program shows.
    const row = page.getByRole('link', { name: new RegExp(seeded.guestName) });
    await expect(row).toContainText(t('admin.messages.awaiting'));
    await expect(row).toContainText('accessible by wheelchair');
    await expectNoRawKeys(page);

    await row.click();

    // The thread says who it is with and where an answer will go, *before* one
    // is written: an organizer typing here is writing a letter (F11).
    await expect(
      page.getByRole('heading', { name: seeded.guestName }),
    ).toBeVisible();
    await expect(page.getByText(seeded.guestEmail).first()).toBeVisible();
    await expect(page.getByText(GUEST.question)).toBeVisible();

    const answer = 'Yes — the whole ground floor is level, and so is the hall.';
    await page.getByLabel(t('admin.messages.reply.label')).fill(answer);
    await page
      .getByRole('button', { name: t('admin.messages.reply.send') })
      .click();

    // The sentence only the server's `delivery` can produce: the mail went out.
    await expect(
      page.getByText(
        t('admin.messages.reply.mailSent', { email: seeded.guestEmail }),
      ),
    ).toBeVisible();
    // And it stays in the conversation, which is the other half of F11.
    const history = page.getByRole('list', {
      name: t('admin.messages.thread.history'),
    });
    await expect(history).toContainText(answer);
    // Scoped to the history and exact: "You" is a word that also starts "Your
    // answer" twice on this screen.
    await expect(
      history.getByText(t('admin.messages.thread.you'), { exact: true }),
    ).toBeVisible();
    await expectNoRawKeys(page);

    // Back in the overview the row has stopped waiting: the organization wrote
    // last, which is what replaces an unread count here (F133).
    await page
      .getByRole('link', { name: t('admin.messages.thread.back') })
      .click();
    await expect(
      page.getByRole('link', { name: new RegExp(seeded.guestName) }),
    ).not.toContainText(t('admin.messages.awaiting'));
  });

  test('assembles a group from the people who confirmed a place', async ({
    page,
  }) => {
    await page.goto('/messages');

    await page
      .getByRole('button', { name: t('admin.messages.group.new') })
      .click();

    const panel = page.getByRole('region', {
      name: t('admin.messages.group.title'),
    });
    await panel
      .getByLabel(t('admin.messages.group.series'))
      .selectOption({ label: seeded.seriesName });
    await panel
      .getByLabel(t('admin.messages.group.event'))
      .selectOption({ index: 1 });

    // The people the event confirmed *and* who have an account. Somebody
    // without one is absent: a membership points at a profile, and they are
    // reached by mail instead (FR 2.4).
    for (const person of MEMBERS) {
      await expect(
        panel.getByText(addressOf(person, seeded.label)),
      ).toBeVisible();
    }
    await expect(
      panel.getByText(addressOf(WITHOUT_ACCOUNT, seeded.label)),
    ).toHaveCount(0);
    await expectNoRawKeys(page);

    const topic = `Travel to Köln ${seeded.label}`;
    await panel.getByLabel(t('admin.messages.group.topic')).fill(topic);
    await panel
      .getByRole('button', { name: t('admin.messages.group.all') })
      .click();
    await panel
      .getByRole('button', { name: t('admin.messages.group.create') })
      .click();

    // Straight into the thread, because a group starts empty and the next
    // thing to do is write the first line.
    await expect(page.getByRole('heading', { name: topic })).toBeVisible();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
    for (const person of MEMBERS) {
      await expect(
        page.getByText(`${person.firstName} ${person.lastName}`).first(),
      ).toBeVisible();
    }
    await expect(
      page.getByText(t('admin.messages.thread.empty')),
    ).toBeVisible();
    // No mail leg for a group: its members read it in the app.
    await expect(
      page.getByText(t('admin.messages.reply.hintGroup')),
    ).toBeVisible();

    const first = 'The bus leaves at eight from the main station.';
    await page.getByLabel(t('admin.messages.reply.label')).fill(first);
    await page
      .getByRole('button', { name: t('admin.messages.reply.send') })
      .click();

    await expect(
      page.getByText(t('admin.messages.reply.posted')),
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: t('admin.messages.thread.history') }),
    ).toContainText(first);
    await expectNoRawKeys(page);

    // And it is in the overview, named by its subject and counting its members.
    await page.goto('/messages');
    const row = page.getByRole('link', { name: new RegExp(topic) });
    await expect(row).toContainText(
      t('admin.messages.members', { count: MEMBERS.length }),
    );
    await expect(row).toContainText(t('admin.messages.group.tag'));
  });

  test('says that a conversation of participants is none of its business', async ({
    page,
  }) => {
    // A uuid that is not the organization's — the same answer an unknown id
    // gets, because an id an organizer may not read is one they must not be
    // able to confirm (F173).
    await page.goto('/messages/11111111-1111-4111-8111-111111111111');

    await expect(
      page.getByText(t('admin.messages.thread.notFound')),
    ).toBeVisible();
    await expectNoRawKeys(page);
  });
});
