import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  removeCheckinEvent,
  seedCheckinEvent,
  type SeededCheckinEvent,
} from './support/checkin-fixtures';
import { selfServicePathFrom, waitForMailTo } from './support/mail';
import { signInWithSeededSession } from './support/participant-session';
import {
  closeSeedDatabase,
  deleteProfiles,
  deleteRegistrationsOfEvent,
  seedConfirmedRegistration,
  seedProfile,
  seedSession,
} from './support/registration-seed';
import { asAdmin } from './support/series-fixtures';

/**
 * Somebody opens their receipt and sees a ticket (FR 3.16, E54) — AP 8 of
 * phase 4, and **half of milestone M11**.
 *
 * The participant's side of the package's acceptance criterion, walked for
 * real: a registration is made through the public form, confirmed through the
 * link in the first mail, and the personal link in the **receipt** is followed
 * to a page where a bundle fetched at runtime turns a row in a plug-in's table
 * into something a camera can read.
 *
 * What only a browser can decide here:
 *
 * - that the mail carries the **way** to the code rather than the code (F198):
 *   the receipt is a core mail with no plug-in content in it, and the picture
 *   is drawn in the browser afterwards;
 * - that the drawing really happens — an `<svg>` with a symbol in it, black on
 *   white, on a page whose colours are the instance's;
 * - that the characters underneath are exactly the code, gaps and all, because
 *   the other half of F199 is a person reading them out to somebody at a door;
 * - that the same page over a **session** shows that registration's ticket
 *   (F148) — one page, two credentials, since AP 4 of phase 3;
 * - that switching the plug-in off takes the section away and leaves the page,
 *   and switching it on again finds the **same** code (E14).
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `qr-checkin`, and `module_config` is one table the whole instance reads while
 * Playwright runs three engines (`docs/rules/e2e-tests.md`).
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const PLUGIN_KEY = 'qr-checkin';

/** This file's own domain, so its teardown cannot take another suite's rows. */
const ADDRESS_DOMAIN = '@qr-checkin-e2e.example.org';

/** Crockford's base32, twenty-six characters — no I, no L, no O, no U. */
const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

async function moduleEnabled(context: APIRequestContext): Promise<boolean> {
  const modules: { key: string; enabled: boolean }[] = await (
    await context.get('/api/admin/modules')
  ).json();
  return modules.find((one) => one.key === PLUGIN_KEY)?.enabled ?? false;
}

async function setModule(
  context: APIRequestContext,
  enabled: boolean,
): Promise<void> {
  const response = await context.patch(`/api/admin/modules/${PLUGIN_KEY}`, {
    data: { enabled },
  });
  expect(response.ok()).toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.describe('the check-in ticket on the self-service page', () => {
  let admin: APIRequestContext;
  /** `null` until read: a crash before the read must not write a guess. */
  let wasEnabled: boolean | null = null;
  let seeded: SeededCheckinEvent;
  /** The personal link out of a real receipt (E11). */
  let mailedPath = '';
  /** The other credential: a seeded account with a registration of its own. */
  let sessionToken = '';
  let sessionRegistrationId = '';

  test.beforeAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    admin = await asAdmin(CLIENT_URL);
    wasEnabled = await moduleEnabled(admin);
    await setModule(admin, true);
    seeded = await seedCheckinEvent(admin, `${process.pid}`);

    mailedPath = await registerAndOpenReceipt(
      admin,
      `e2e-ticket-${process.pid}${ADDRESS_DOMAIN}`,
    );

    // The session half. Seeded rather than registered for: a second trip
    // through the form would cost two more mails out of a budget three e2e
    // projects share (E4), and what is under test here is the page, not the
    // double opt-in.
    const address = `e2e-session-${process.pid}${ADDRESS_DOMAIN}`;
    sessionRegistrationId = await seedConfirmedRegistration(seeded.eventId, {
      email: address,
      firstName: 'Bo',
      lastName: 'Zhang',
    });
    sessionToken = await seedSession(
      await seedProfile({
        email: address,
        firstName: 'Bo',
        lastName: 'Zhang',
      }),
    );
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      await deleteProfiles(ADDRESS_DOMAIN);
      // The registrations first, or the series refuses to go: an organizer may
      // not delete a series that has confirmed registrations under it (E14).
      if (seeded) {
        await deleteRegistrationsOfEvent(seeded.eventId);
        await removeCheckinEvent(admin, seeded);
      }
    } finally {
      await closeSeedDatabase();
      if (wasEnabled !== null) await setModule(admin, wasEnabled);
      await admin.dispose();
    }
  });

  /** Registers through the public form, confirms, and returns the link. */
  async function registerAndOpenReceipt(
    context: APIRequestContext,
    email: string,
  ): Promise<string> {
    const registered = await context.post(
      `/api/user/series/${seeded.seriesSlug}/events/${seeded.eventSlug}/registrations`,
      {
        data: {
          firstName: 'Amina',
          lastName: 'Okonkwo',
          email,
          customFields: {},
        },
      },
    );
    expect(`${registered.status()} ${await registered.text()}`).toMatch(/^202/);

    const invitation = await waitForMailTo(email, {
      text: /\/registrations\/confirm\?token=/,
    });
    const token = new URL(
      `http://localhost${/\/registrations\/confirm\?token=[^\s]+/.exec(invitation.text)?.[0] ?? ''}`,
    ).searchParams.get('token');
    const confirmed = await context.post('/api/user/registrations/confirm', {
      data: { token },
    });
    expect(`${confirmed.status()} ${await confirmed.text()}`).toMatch(/^200/);

    // The receipt is the message with the personal link in it — the one E54
    // rests on: it carries the way to the code, never the code.
    return selfServicePathFrom(
      await waitForMailTo(email, { text: /\/registrations\/me\?token=/ }),
    );
  }

  const section = (page: Page) => page.locator('trefaro-plugin-qr-checkin');

  const word = (key: string, locale?: string): string =>
    locale
      ? t(`plugins.qrCheckin.${key}`, {}, locale)
      : t(`plugins.qrCheckin.${key}`);

  const codeOn = async (page: Page): Promise<string> =>
    (await section(page).locator('.characters').textContent()) ?? '';

  test('turns the link from the receipt into a code a camera can read (E54, F198)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(mailedPath);
    const element = section(page);
    await expect(element).toBeAttached();
    await expect(element).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await expect(element).toContainText(word('ticketTitle'));

    // Drawn here, in the browser, out of the characters the plug-in issued —
    // the mail carried a link and nothing else.
    const svg = element.locator('.code svg');
    await expect(svg).toBeAttached();
    expect(await svg.locator('path').count()).toBeGreaterThan(1);
    // Black on white: the one thing in this application that does not follow
    // the instance's colours, because a tinted code is one a scanner argues
    // with.
    expect(await svg.innerHTML()).toContain('#ffffff');
    expect(await svg.innerHTML()).toContain('#000000');

    // And the characters underneath, for the half of F199 that is a telephone.
    expect(await codeOn(page)).toMatch(CODE_PATTERN);
    await expectNoRawKeys(page);
  });

  test('shows the same code every time the link is opened (E53)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(mailedPath);
    const first = await codeOn(page);
    await page.reload();

    expect(await codeOn(page)).toBe(first);
  });

  test('shows this registration’s ticket over a session as well (F148)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, sessionToken);

    await page.goto(`/registrations/${sessionRegistrationId}`);

    await expect(section(page)).toContainText(word('ticketTitle'));
    await expect(section(page).locator('.code svg')).toBeAttached();
    const code = await codeOn(page);
    expect(code).toMatch(CODE_PATTERN);
    // Bo's ticket, not Amina's: the page is about one registration.
    await page.goto(mailedPath);
    expect(await codeOn(page)).not.toBe(code);
    await expectNoRawKeys(page);
  });

  test('follows a language switch without a reload and without a remount', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(mailedPath);
    const element = section(page);
    await expect(element).toContainText(word('ticketTitle'));

    // Two sentinels: one on the window, so a reload would be noticed, and one
    // on the element itself, so a remount would be.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>)['e2eStillHere'] = true;
      document
        .querySelector('trefaro-plugin-qr-checkin')
        ?.setAttribute('data-e2e-mounted-once', 'yes');
    });

    await page.getByRole('combobox').selectOption('de');

    await expect(element).toContainText(word('ticketTitle', 'de'));
    await expect(element).toHaveAttribute('data-e2e-mounted-once', 'yes');
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>)['e2eStillHere'],
      ),
    ).toBe(true);
    await expectNoRawKeys(page);
  });

  test('fits a phone, which is where a ticket is held up', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(mailedPath);
    await expect(section(page).locator('.code svg')).toBeAttached();

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test('takes the section away when it is switched off, and keeps the code (E14)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(mailedPath);
    const before = await codeOn(page);
    await setModule(admin, false);

    try {
      await page.goto(mailedPath);
      // The page it is mounted on is untouched — the registration is a core
      // matter and the ticket is not (E21).
      await expect(
        page.getByRole('heading', { level: 1, name: t('mine.title') }),
      ).toBeVisible();
      await expect(page.getByText('Amina Okonkwo')).toBeVisible();
      await expect(section(page)).toHaveCount(0);
    } finally {
      await setModule(admin, true);
    }

    await page.goto(mailedPath);
    // Switching a plug-in off never deletes anything: the same code comes back.
    expect(await codeOn(page)).toBe(before);
  });
});
