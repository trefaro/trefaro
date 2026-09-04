import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import { accountConfirmationPathFrom, waitForMailTo } from './support/mail';
import { png } from './support/png';
import {
  removeProfileField,
  seedProfileField,
} from './support/profile-fixtures';
import {
  closeSeedDatabase,
  deleteProfiles,
  seedConfirmedRegistration,
  seedSearchableProfile,
} from './support/registration-seed';
import { asAdmin } from './support/series-fixtures';

/**
 * A participant account in a browser (FR 4.1–4.3, UC 09) — AP 3 of phase 3.
 *
 * The whole of it, through the parts a person actually touches: the registration
 * form, the mail, the page its link points at, the login, the profile with the
 * organization's own questions on it, the picture, and the password. The mail is
 * read out of Mailpit, because a double opt-in that is only asserted inside the
 * server has not been shown to work.
 *
 * **One login per engine.** The participant login allows twenty attempts per
 * five minutes and client address, shared with the API contract suites (E4), so
 * this file signs in exactly once per browser and proves the new password
 * differently: that it works, and that other sessions end, is asserted in
 * `apps/server-e2e/src/api/participant-profile.spec.ts`, where the sessions can
 * be counted without a race.
 *
 * Each engine registers its own address and seeds its own profile question — the
 * field kit is instance-wide, and three engines sharing one would be three
 * engines editing one row.
 *
 * Since AP 4 the same test also walks "my registrations" (FR 4.7), and since
 * AP 5 the participant search (FR 4.4). Both have to happen in here rather than
 * in files of their own for the reason above: each new file would mean three
 * more logins, and there are twenty per five minutes for every suite of this
 * repository together. The person the search finds is seeded, in **this
 * engine's** address domain, so the teardown that already exists removes them.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

/**
 * The mail domain of one engine's accounts, and what its teardown deletes by.
 *
 * Per engine, and that is the whole point. Three engines run this file at the
 * same time against one instance, and the teardown removes accounts **by
 * pattern** because there is no endpoint that deletes one. A shared domain
 * therefore meant the first engine to finish deleting the other two engines'
 * live accounts — their session rows went with the profile, their next request
 * answered 401, and the interceptor moved them to the login form in the middle
 * of a test. The failure looked like a broken login and was a teardown.
 */
const addressDomain = (engine: string) => `@${engine}.profiles.example.org`;

const PASSWORD = 'a long enough passphrase';
const NEW_PASSWORD = 'an even longer passphrase';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Created {
  id: string;
}

/**
 * A confirmed registration for this account's address, on an event of its own.
 *
 * Its own series and event per engine, because the row is found by address
 * equality (E31) and three engines sharing one event would be three engines
 * reading each other's list. The series and the event go through the
 * administrative API — the path an organizer takes — and the registration is
 * seeded by SQL (see `support/registration-seed.ts` for why: a public
 * registration costs two mails and a slice of the rate limit).
 */
async function seedRegistrationFor(
  admin: APIRequestContext,
  email: string,
  label: string,
): Promise<{ seriesId: string; registrationId: string; eventName: string }> {
  const series: Created = await (
    await admin.post('/api/admin/series', {
      data: {
        name: `E2E Series My Registrations ${label}`,
        description: 'Holds the event this account is registered for.',
        status: 'published',
      },
    })
  ).json();

  const eventName = `E2E My Registration Event ${label}`;
  const event: Created = await (
    await admin.post(`/api/admin/series/${series.id}/events`, {
      data: {
        name: eventName,
        description: 'The event the account’s own registration is for.',
        eventType: 'onsite',
        startsAt: new Date(Date.now() + 40 * DAY_MS).toISOString(),
        endsAt: new Date(Date.now() + 41 * DAY_MS).toISOString(),
        timezone: 'Europe/Berlin',
        venueName: 'E2E Bürgerhaus Kalk',
        languages: ['de'],
        status: 'published',
      },
    })
  ).json();

  const registrationId = await seedConfirmedRegistration(event.id, {
    email,
    firstName: 'Amina',
    lastName: 'Okonkwo',
  });

  return { seriesId: series.id, registrationId, eventName };
}

test.describe.configure({ mode: 'serial' });

test.describe('a participant account', () => {
  const seededFields: string[] = [];
  /** The series and the registration this engine seeded, for the teardown. */
  let seeded: { seriesId: string; registrationId: string } | null = null;
  /**
   * The engine this worker is running, set by the test that creates accounts.
   *
   * Read from `testInfo` in the test rather than in a `beforeEach`, because
   * Playwright insists on a destructuring pattern as a hook's first argument
   * and there is no fixture this hook would want.
   */
  let engine = '';

  test.afterAll(async () => {
    for (const id of seededFields) {
      await removeProfileField(CLIENT_URL, id);
    }
    seededFields.length = 0;
    if (seeded) {
      // The registration first: a confirmed one blocks deleting its series
      // (E14), which is the rule this suite relies on rather than tests.
      const admin = await asAdmin(CLIENT_URL);
      try {
        await admin.delete(`/api/admin/registrations/${seeded.registrationId}`);
        await admin.delete(`/api/admin/series/${seeded.seriesId}`);
      } finally {
        await admin.dispose();
      }
      seeded = null;
    }
    // The address is unique across the instance (E31), so a leftover account
    // would send the next run down the "there is already one" branch. Only
    // this engine's, for the reason beside `addressDomain`.
    if (engine) await deleteProfiles(addressDomain(engine));
    await closeSeedDatabase();
  });

  test('sends an anonymous visitor to the login and remembers where they were going', async ({
    page,
  }) => {
    await page.goto('/profile');

    await expect(page).toHaveURL(/\/profile\/login/);
    await expect(
      page.getByRole('heading', { name: t('profile.login.title') }),
    ).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('registers, confirms by mail, signs in, edits the profile and its picture', async ({
    page,
  }, testInfo) => {
    engine = testInfo.project.name;
    const email = `e2e-${Date.now()}${addressDomain(engine)}`;
    // The engine is in the wording as well as in the key: the profile form
    // shows every instance-wide question, so all three engines' questions are
    // on this page and a shared sentence would match three elements.
    const helpText = `So we can put you in touch locally (${engine}).`;
    const question = await seedProfileField(CLIENT_URL, {
      key: `e2e-local-group-${engine}`,
      label: `E2E local group (${engine})`,
      helpText,
    });
    seededFields.push(question.id);

    // --- registering ------------------------------------------------------
    await page.goto('/profile/register');
    await expectNoRawKeys(page);
    await page.getByLabel(t('profile.firstName')).fill('Amina');
    await page.getByLabel(t('profile.lastName')).fill('Okonkwo');
    await page.getByLabel(t('profile.email')).fill(email);
    await page.getByLabel(t('profile.password')).fill(PASSWORD);
    await page
      .getByRole('button', { name: t('profile.register.title') })
      .click();

    // Nothing is usable yet, and the page says so rather than welcoming anybody.
    await expect(
      page.getByRole('heading', { name: t('profile.register.done.title') }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // --- the mail ---------------------------------------------------------
    const mail = await waitForMailTo(email, {
      subject: new RegExp(t('mail.profileConfirm.subject')),
    });
    await page.goto(accountConfirmationPathFrom(mail));

    // The link opens a page; a button confirms. A mail scanner that prefetches
    // every URL must not be able to confirm an address (E5b).
    await expect(
      page.getByRole('heading', { name: t('profile.confirm.title') }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: t('profile.confirm.title') })
      .click();
    await expect(
      page.getByRole('heading', { name: t('profile.confirm.done') }),
    ).toBeVisible();

    // --- signing in -------------------------------------------------------
    // Scoped to the content: the navigation carries a sign-in link of its own
    // while nobody is logged in, and both name the same page (F80).
    await page
      .getByRole('main')
      .getByRole('link', { name: t('profile.login.title') })
      .click();
    await page.getByLabel(t('profile.email')).fill(email);
    await page.getByLabel(t('profile.password')).fill(PASSWORD);
    await page.getByRole('button', { name: t('profile.login.title') }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByRole('heading', { name: t('profile.title') }),
    ).toBeVisible();
    await expectNoRawKeys(page);
    // The address is shown and not editable: it is the identity (E31).
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByLabel(t('profile.firstName'))).toHaveValue('Amina');

    // --- the form, including the organization's own question --------------
    await page
      .getByLabel(t('profile.activityAreas'))
      .fill('Election observation, citizens’ assemblies');
    // Drawn by the component the registration form uses as well (E35), down to
    // the explanation underneath.
    await expect(page.getByText(helpText)).toBeVisible();
    await page.getByLabel(question.label).fill('Cologne');
    await page.getByRole('button', { name: t('profile.save') }).click();
    await expect(page.getByText(t('profile.saved'))).toBeVisible();

    // Read back from the server rather than from the form that wrote it.
    await page.reload();
    await expect(page.getByLabel(t('profile.activityAreas'))).toHaveValue(
      'Election observation, citizens’ assemblies',
    );
    await expect(page.getByLabel(question.label)).toHaveValue('Cologne');

    // --- the picture ------------------------------------------------------
    const avatar = page.getByRole('region', {
      name: t('profile.avatar.heading'),
    });
    // Until there is one, the initials stand in.
    await expect(avatar.getByText('AO')).toBeVisible();
    await page.getByLabel(t('profile.avatar.choose')).setInputFiles({
      name: 'me.png',
      mimeType: 'image/png',
      buffer: png(64, 64),
    });
    // Choosing does not save: the preview comes first, because this picture is
    // of a person and they see it before anybody else does.
    await expect(avatar.getByText('me.png')).toBeVisible();
    await page.getByRole('button', { name: t('profile.avatar.save') }).click();

    const picture = avatar.getByRole('img', { name: t('profile.avatar.alt') });
    await expect(picture).toBeVisible();
    // Served by a route that carries no stored path and needs no session
    // (F124), with a `?v=` that moves when the bytes do.
    await expect(picture).toHaveAttribute(
      'src',
      /\/api\/media\/profiles\/[0-9a-f-]{36}\/avatar\?v=\d+/,
    );

    await page
      .getByRole('button', { name: t('profile.avatar.remove') })
      .click();
    await expect(avatar.getByText('AO')).toBeVisible();

    // --- the password -----------------------------------------------------
    await page.getByLabel(t('profile.changePassword.current')).fill(PASSWORD);
    await page.getByLabel(t('profile.changePassword.new')).fill(NEW_PASSWORD);
    await page
      .getByRole('button', { name: t('profile.changePassword.submit') })
      .click();

    await expect(
      page.getByText(t('profile.changePassword.done')),
    ).toBeVisible();
    // Emptied afterwards: two boxes still holding a passphrase are two boxes on
    // a screen somebody may walk away from.
    await expect(
      page.getByLabel(t('profile.changePassword.current')),
    ).toHaveValue('');

    // --- notifications (FR 3.15) ------------------------------------------
    // The switch AP 11 put on this page, in the one state a browser without a
    // service worker can be in — which is every browser here, because Angular
    // registers one only in a production build. That is not a gap in this
    // assertion but the point of it: the sentence an iPhone in a Safari tab
    // sees is the same one, and it is the case the decision to make Web Push
    // the only channel depends on (F7). Whether a notification then arrives is
    // the device matrix in `docs/spikes/03-web-push.md`.
    await expect(
      page.getByRole('heading', { name: t('push.settings.title') }),
    ).toBeVisible();
    await expect(page.getByText(t('push.unsupported'))).toBeVisible();
    await expect(page.getByText(t('push.installFirst'))).toBeVisible();
    // No button: nothing here can be switched on, and an offer that cannot be
    // followed is worse than an explanation.
    await expect(
      page.getByRole('button', { name: t('push.settings.enable') }),
    ).toHaveCount(0);
    await expectNoRawKeys(page);

    // --- my registrations (FR 4.7) ----------------------------------------
    const admin = await asAdmin(CLIENT_URL);
    let eventName = '';
    try {
      const fixture = await seedRegistrationFor(admin, email, engine);
      seeded = fixture;
      eventName = fixture.eventName;
    } finally {
      await admin.dispose();
    }

    // The navigation entry that was missing until there was a login to put in
    // front of it (E11).
    await page
      .getByRole('navigation', { name: t('app.nav.label') })
      .getByRole('link', { name: t('mine.list.title') })
      .click();
    await expect(page).toHaveURL(/\/registrations$/);
    await expectNoRawKeys(page);

    // Found by address equality, so a row written before this account existed
    // belongs to it (E31).
    const entry = page.getByRole('link', { name: eventName });
    await expect(entry).toBeVisible();
    await entry.click();

    // No token anywhere in the address, and the page is the same one the mailed
    // link opens.
    await expect(page).toHaveURL(/\/registrations\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', { name: t('mine.title') }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expectNoRawKeys(page);
    // What a session does not get: the warning about a link it does not hold.
    await expect(page.getByText(t('mine.keepLink'))).toHaveCount(0);

    // What it does get since AP 12 (FR 4.7): the cancellation. It asks first,
    // because registering again is a new registration and not an undo.
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: t('mine.cancel') }).click();
    await expect(page.getByRole('status')).toHaveText(t('mine.cancelled'));
    // And the button is gone with it: there is nothing left to cancel.
    await expect(
      page.getByRole('button', { name: t('mine.cancel') }),
    ).toHaveCount(0);

    await page.getByRole('link', { name: t('mine.list.back') }).click();
    await expect(page).toHaveURL(/\/registrations$/);

    // --- finding other participants (FR 4.4) ------------------------------
    // Somebody to find, per engine: what is searchable is instance-wide, so
    // all three engines' fixtures are in the directory at the same time and a
    // shared name would make each engine assert on another's row.
    const findable = {
      firstName: 'Bo',
      lastName: `E2E-Findable-${engine}`,
      activityAreas: `Election observation in ${engine}`,
    };
    await seedSearchableProfile({
      ...findable,
      email: `findable-${Date.now()}${addressDomain(engine)}`,
    });

    // The opt-in that AP 3 deliberately left off this form until there was a
    // search to switch on (F142).
    await page.goto('/profile');
    const optIn = page.getByLabel(t('profile.searchable'));
    await expect(optIn).not.toBeChecked();
    await optIn.check();
    await page.getByRole('button', { name: t('profile.save') }).click();
    await expect(page.getByText(t('profile.saved'))).toBeVisible();
    // Read back from the server: a tick that only lives in the form promises a
    // visibility nobody has been given.
    await page.reload();
    await expect(page.getByLabel(t('profile.searchable'))).toBeChecked();

    await page
      .getByRole('navigation', { name: t('app.nav.label') })
      .getByRole('link', { name: t('people.title') })
      .click();
    await expect(page).toHaveURL(/\/participants$/);
    await expectNoRawKeys(page);
    // The sentence for somebody who cannot be found is gone, because they can.
    await expect(page.getByText(t('people.optIn'))).toHaveCount(0);

    await page.getByLabel(t('people.query')).fill(findable.lastName);
    await page.getByRole('button', { name: t('people.submit') }).click();

    const person = page.getByRole('link', {
      name: `${findable.firstName} ${findable.lastName}`,
    });
    await expect(person).toBeVisible();
    // The row carries what they work on, which is the other half of what the
    // search searches (E36). That the reader is never in their own result is
    // asserted where the whole result set can be counted, in
    // `apps/server-e2e/src/api/profile-search.spec.ts`.
    await expect(page.getByText(findable.activityAreas)).toBeVisible();
    await person.click();

    await expect(page).toHaveURL(/\/participants\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', {
        name: `${findable.firstName} ${findable.lastName}`,
      }),
    ).toBeVisible();
    await expect(page.getByText(findable.activityAreas)).toBeVisible();
    await expectNoRawKeys(page);
    await page.getByRole('link', { name: t('people.detail.back') }).click();
    await expect(page).toHaveURL(/\/participants$/);

    // --- signing out ------------------------------------------------------
    await page.getByRole('button', { name: t('app.nav.signOut') }).click();
    await expect(page).toHaveURL(CLIENT_URL + '/');
    await expect(
      page
        .getByRole('navigation', { name: t('app.nav.label') })
        .getByRole('link', { name: t('profile.login.title') }),
    ).toBeVisible();
  });
});
