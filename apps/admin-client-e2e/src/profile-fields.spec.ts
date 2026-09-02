import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { t } from './support/catalogue';

/**
 * Defining what this organization asks the people in its community (FR 4.3,
 * E35) — AP 3 of phase 3.
 *
 * **Chromium only, and serial.** The profile field kit is instance-wide: it
 * hangs off no event, so unlike the registration form there is no parent whose
 * deletion tidies up after a test. Three engines editing one collection would
 * be three engines editing one row, and a leftover *required* question would
 * make every other suite's profile update fail. So this file runs in one engine,
 * one test at a time, gives every question a key with the run's label in it, and
 * deletes what it made — including on the way out of a failing test.
 *
 * The neighbour of this spec is `registration-fields.spec.ts`, and the two
 * assert the same rules on purpose: an organizer should not have to learn two
 * field editors, so the two editors must not drift apart.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe.configure({ mode: 'serial' });

test.describe('the profile form of the instance', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'The profile field kit is instance-wide; one engine writes it (see the file comment).',
  );

  /** Every question this spec creates, removed again after each test. */
  let created: string[] = [];

  test.afterEach(async ({ page }) => {
    for (const id of created) {
      await page.request.delete(`/api/admin/profile-fields/${id}`);
    }
    created = [];
  });

  /**
   * Remembers what the interface just created, so the teardown can remove it.
   *
   * Matched on this test's own label rather than on a bare `e2e-`: the
   * participant client's suite defines instance-wide questions of its own, and
   * a teardown that deleted every question with a test-looking key would delete
   * a fixture another suite is still using.
   */
  async function trackAll(page: Page, label: string): Promise<void> {
    const response = await page.request.get('/api/admin/profile-fields');
    const fields = (await response.json()) as { id: string; key: string }[];
    for (const field of fields) {
      if (
        field.key.includes(label.toLowerCase()) &&
        !created.includes(field.id)
      ) {
        created.push(field.id);
      }
    }
  }

  const questions = (page: Page) =>
    page
      .getByRole('region', { name: t('admin.profileFields.yourQuestions') })
      .getByRole('listitem');

  /**
   * The card of one question, found by its key.
   *
   * By the key rather than by the wording: the wording sits in an input value,
   * which is not text a locator can match — and the key is the one thing about
   * a question that does not change (F35).
   */
  const question = (page: Page, key: string) =>
    questions(page).filter({ hasText: key });

  const addForm = (page: Page) =>
    page.getByRole('region', { name: t('admin.profileFields.addHeading') });

  test('is reachable from the navigation', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('link', { name: t('admin.profileFields.title') })
      .click();

    await expect(page).toHaveURL(/\/profile-form$/);
    await expect(
      page.getByRole('heading', { name: t('admin.profileFields.title') }),
    ).toBeVisible();
  });

  test('adds a question and shows the key its answers are stored under', async ({
    page,
  }, testInfo) => {
    const label = fixtureLabel(testInfo.project.name);
    await page.goto('/profile-form');

    const form = addForm(page);
    await form
      .getByLabel(t('admin.profileFields.question'))
      .fill(`E2E local group ${label}`);
    await form
      .getByLabel(t('admin.profileFields.explanation'))
      .fill('So we can put you in touch locally.');
    await form
      .getByRole('button', { name: t('admin.profileFields.add') })
      .click();

    await trackAll(page, label);
    const key = `e2e-local-group-${label.toLowerCase()}`;
    const card = question(page, key);
    await expect(card).toBeVisible();
    // The badge names the kind of answer from the catalogue, not the stored
    // word — the same key the registration form's editor uses (F83).
    await expect(
      card.getByText(t('admin.fields.type.text'), { exact: true }),
    ).toBeVisible();
  });

  test('offers the choices of a selection field as one line each', async ({
    page,
  }, testInfo) => {
    const label = fixtureLabel(testInfo.project.name);
    await page.goto('/profile-form');

    const form = addForm(page);
    await form
      .getByLabel(t('admin.profileFields.question'))
      .fill(`E2E committee ${label}`);
    await form
      .getByLabel(t('admin.profileFields.answerKind'))
      .selectOption('select');
    // Exactly: a select element's accessible name carries its option text.
    await form
      .getByLabel(t('admin.profileFields.choices'), { exact: true })
      .fill('Board\nWorking group\nNone\n\n');
    await form
      .getByRole('button', { name: t('admin.profileFields.add') })
      .click();

    await trackAll(page, label);
    const card = question(page, `e2e-committee-${label.toLowerCase()}`);
    await expect(
      card.getByText(t('admin.fields.type.select'), { exact: true }),
    ).toBeVisible();
    // The blank line is dropped rather than turned into an empty choice.
    await expect(
      card.getByLabel(t('admin.profileFields.choices'), { exact: true }),
    ).toHaveValue('Board\nWorking group\nNone');
  });

  test('has no file among the kinds of answer (F37)', async ({ page }) => {
    await page.goto('/profile-form');

    const kinds = addForm(page).getByLabel(t('admin.profileFields.answerKind'));

    // A file answers with bytes in an attachment row hanging off a
    // registration, and a profile has no registration to hang one on.
    await expect(kinds.getByRole('option')).toHaveCount(3);
    await expect(
      kinds.getByRole('option', { name: t('admin.fields.type.file') }),
    ).toHaveCount(0);
  });

  test('keeps the key when the question is reworded', async ({
    page,
  }, testInfo) => {
    const label = fixtureLabel(testInfo.project.name);
    await page.goto('/profile-form');

    const form = addForm(page);
    await form
      .getByLabel(t('admin.profileFields.question'))
      .fill(`E2E hometown ${label}`);
    await form
      .getByRole('button', { name: t('admin.profileFields.add') })
      .click();
    await trackAll(page, label);

    const key = `e2e-hometown-${label.toLowerCase()}`;
    const card = question(page, key);
    await expect(card).toBeVisible();
    await card
      .getByLabel(t('admin.profileFields.question'))
      .fill(`E2E where do you live ${label}`);
    await card.getByRole('button', { name: t('admin.common.save') }).click();

    // Same card, same key: rephrasing must not orphan the answers already
    // given (F35).
    await expect(
      card.getByLabel(t('admin.profileFields.question')),
    ).toHaveValue(`E2E where do you live ${label}`);
    await expect(question(page, key)).toBeVisible();
  });

  test('moves a question and keeps the order it was given', async ({
    page,
  }, testInfo) => {
    const label = fixtureLabel(testInfo.project.name);
    await page.goto('/profile-form');

    const form = addForm(page);
    for (const name of [`E2E first ${label}`, `E2E second ${label}`]) {
      await form.getByLabel(t('admin.profileFields.question')).fill(name);
      await form
        .getByRole('button', { name: t('admin.profileFields.add') })
        .click();
      await expect(
        form.getByLabel(t('admin.profileFields.question')),
      ).toHaveValue('');
    }
    await trackAll(page, label);

    const second = question(page, `e2e-second-${label.toLowerCase()}`);
    await second
      .getByRole('button', {
        name: t('admin.profileFields.moveUp', {
          label: `E2E second ${label}`,
        }),
      })
      .click();

    // The order survives a reload, because it is the server's and was sent as
    // the whole list rather than as "move this one".
    await page.reload();
    // Awaited before the texts are read: `allInnerTexts` does not wait, and a
    // freshly reloaded page has not fetched its questions yet.
    await expect(
      question(page, `e2e-first-${label.toLowerCase()}`),
    ).toBeVisible();
    const keys = await questions(page).allInnerTexts();
    const first = keys.findIndex((text) =>
      text.includes(`e2e-first-${label.toLowerCase()}`),
    );
    const moved = keys.findIndex((text) =>
      text.includes(`e2e-second-${label.toLowerCase()}`),
    );
    expect(moved).toBeLessThan(first);
  });

  test('says that deleting a question keeps the answers (F34)', async ({
    page,
  }, testInfo) => {
    const label = fixtureLabel(testInfo.project.name);
    await page.goto('/profile-form');

    const form = addForm(page);
    await form
      .getByLabel(t('admin.profileFields.question'))
      .fill(`E2E leaving ${label}`);
    await form
      .getByRole('button', { name: t('admin.profileFields.add') })
      .click();
    await trackAll(page, label);

    const key = `e2e-leaving-${label.toLowerCase()}`;
    await expect(question(page, key)).toBeVisible();
    // Stated on the page, not only in the confirmation: "delete" normally
    // means the data goes with the question, and here it does not.
    await expect(
      page.getByText(t('admin.profileFields.deletionKeepsAnswers')),
    ).toBeVisible();

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('answers already given are kept');
      void dialog.accept();
    });
    await question(page, key)
      .getByRole('button', { name: t('admin.common.delete') })
      .click();

    await expect(question(page, key)).toHaveCount(0);
  });

  test('refuses a selection field with no choices, with the reason', async ({
    page,
  }, testInfo) => {
    const label = fixtureLabel(testInfo.project.name);
    await page.goto('/profile-form');

    const form = addForm(page);
    await form
      .getByLabel(t('admin.profileFields.question'))
      .fill(`E2E empty choices ${label}`);
    await form
      .getByLabel(t('admin.profileFields.answerKind'))
      .selectOption('select');
    await form
      .getByRole('button', { name: t('admin.profileFields.add') })
      .click();
    await trackAll(page, label);

    // The server's rule, surfaced where the organizer can act on it (F77).
    await expect(page.getByRole('alert')).toContainText('at least one choice');
  });
});
