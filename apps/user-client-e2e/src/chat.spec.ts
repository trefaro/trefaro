import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  sessionHeader,
  signInWithSeededSession,
} from './support/participant-session';
import { png } from './support/png';
import {
  closeSeedDatabase,
  deleteConversationsOfProfiles,
  deleteProfiles,
  seedSearchableProfile,
  seedSession,
} from './support/registration-seed';

/**
 * The chat in a browser (FR 4.5, UC 13) — AP 8 of phase 3.
 *
 * The acceptance criterion of this package as one walk: a conversation is
 * started from the participant search, a message with a picture goes out and
 * the picture is *visible*, the other side's answer arrives **without a
 * reload**, the unread counter appears and disappears again by being read, and
 * a lost connection is said out loud rather than hidden.
 *
 * **No login at all, and that is deliberate** (F164). The participant login
 * allows twenty attempts per five minutes for the whole instance and the
 * suites of this repository already use nineteen; three engines signing in
 * here would turn somebody else's green test into a 429 that reads like a
 * broken login. So both accounts are seeded and the browser is handed the
 * cookie a login would have set — the form itself is walked in
 * `profile.spec.ts`, against the same guard chain.
 *
 * The **other side answers over HTTP**, from the test process, with its own
 * seeded session. That is what makes this a real-time test rather than a
 * rendering test: nothing in the browser asked for that message, and it has to
 * appear anyway — through the Angular dev server's proxy, which is the one
 * piece of the socket's path that no other suite of this repository touches.
 *
 * Each engine seeds its own two accounts in its own address domain, for the
 * reason spelled out in `profile.spec.ts`: three engines run this file at the
 * same time against one instance, and the teardown deletes by pattern.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const addressDomain = (engine: string) => `@${engine}.chat.example.org`;

/** Both sides, as this suite seeds them. */
interface Side {
  readonly id: string;
  readonly session: string;
}

async function seedSide(
  email: string,
  firstName: string,
  lastName: string,
): Promise<Side> {
  const id = await seedSearchableProfile({
    email,
    firstName,
    lastName,
    activityAreas: 'Election observation',
  });
  return { id, session: await seedSession(id) };
}

/** The other side, saying something over HTTP with its own session. */
async function answer(
  request: APIRequestContext,
  side: Side,
  conversationId: string,
  body: string,
): Promise<void> {
  const response = await request.post(
    `${CLIENT_URL}/api/participant/conversations/${conversationId}/messages`,
    { data: { body }, headers: sessionHeader(side.session) },
  );
  if (!response.ok()) {
    throw new Error(
      `The other side could not write (${response.status()}): ` +
        (await response.text()),
    );
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('the chat', () => {
  let engine = '';

  test.afterAll(async () => {
    if (engine) {
      // The conversations first: their members carry no foreign key to a
      // profile (E39), so deleting the accounts would leave them standing —
      // and the order inside is the one F158 spells out.
      await deleteConversationsOfProfiles(addressDomain(engine));
      await deleteProfiles(addressDomain(engine));
    }
    await closeSeedDatabase();
  });

  test('starts a conversation from the search, sends a picture, and hears back live', async ({
    page,
    context,
    request,
  }, testInfo) => {
    engine = testInfo.project.name;
    const domain = addressDomain(engine);

    // A phone, because that is the acceptance criterion of this package: the
    // three engines run at desktop sizes like every other file of this suite,
    // and a conversation that only works there is not the one FR 4.5 asks for.
    // Every click below therefore happens at 390 by 844.
    await page.setViewportSize({ width: 390, height: 844 });

    const me = await seedSide(`reader${domain}`, 'Rea', 'Reader');
    const other = await seedSide(`amina${domain}`, 'Amina', `Okonkwo${engine}`);
    await signInWithSeededSession(context, CLIENT_URL, me.session);

    // ---- the way in: the participant search (E37) -------------------------
    await page.goto('/participants');
    await page.getByLabel(t('people.query')).fill(`Okonkwo${engine}`);
    await page.getByRole('button', { name: t('people.submit') }).click();
    await page.getByRole('link', { name: `Amina Okonkwo${engine}` }).click();
    await expect(page).toHaveURL(/\/participants\//);

    await page.getByRole('button', { name: t('people.detail.write') }).click();
    // Two people have exactly one conversation, and this is its address
    // (F153) — the id in the URL is what everything below asks about.
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
    const conversationId = page.url().split('/').pop() as string;
    await expectNoRawKeys(page);

    // ---- text and a picture, in one message (E40) -------------------------
    await page.getByLabel(t('chat.compose.label')).fill('Good to meet you.');
    await page.getByLabel(t('chat.compose.choose')).setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: png(32, 32),
    });
    await page.getByRole('button', { name: t('chat.compose.send') }).click();

    await expect(page.getByText('Good to meet you.')).toBeVisible();
    const picture = page.getByAltText(t('chat.thread.image'));
    await expect(picture).toBeVisible();
    // Visible is not enough: the media route is the one that checks a
    // permission (F156), and a broken image is visible too. The bytes have to
    // have arrived — with the session cookie, which travels because the route
    // is under /api.
    await expect
      .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    // The box is empty again, and the chosen picture is gone with it.
    await expect(page.getByLabel(t('chat.compose.label'))).toHaveValue('');

    // ---- the other side answers, and nothing here asked for it ------------
    await answer(request, other, conversationId, 'And you. See you in Kyiv.');
    await expect(page.getByText('And you. See you in Kyiv.')).toBeVisible();

    // ---- the list: named by who it is with, and caught up -----------------
    await page.getByRole('link', { name: t('chat.thread.back') }).click();
    await expect(page).toHaveURL(/\/messages$/);
    const row = page.getByRole('link', { name: /Amina Okonkwo/ });
    await expect(row).toBeVisible();
    // Read, because the answer arrived while the conversation was open (E38).
    await expect(page.locator('.thread__unread')).toHaveCount(0);
    await expectNoRawKeys(page);

    // ---- a message that arrives while nobody is looking at the thread -----
    await answer(request, other, conversationId, 'One more thing:');
    // The list moves by itself: the member's own room carries "one of yours
    // moved" and is joined at the handshake (F161).
    await expect(
      page.locator('.thread__unread').filter({ hasText: '1' }),
    ).toBeVisible();

    // ---- and reading it makes the counter go away ------------------------
    await row.click();
    await expect(page.getByText('One more thing:')).toBeVisible();
    await page.getByRole('link', { name: t('chat.thread.back') }).click();
    await expect(page.locator('.thread__unread')).toHaveCount(0);

    // ---- and while it is connected, it says so ---------------------------
    await expect(page.getByText(t('chat.live.on'))).toBeVisible();

    // Nothing sticks out sideways on that phone: a chat whose composer is off
    // the screen is unusable in the one way this package is about.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('says out loud when nothing is arriving by itself', async ({
    page,
    context,
  }, testInfo) => {
    engine = testInfo.project.name;
    const me = await seedSide(
      `silent${addressDomain(engine)}`,
      'Ola',
      'Offline',
    );
    await signInWithSeededSession(context, CLIENT_URL, me.session);

    // The deployment mistake Spike 4 was about: a proxy that forwards the
    // upgrade and then swallows everything. The socket opens and the handshake
    // never answers — which is indistinguishable, from the outside, from a
    // chat in which nobody is writing. So the screen has to say it (F110), and
    // it may not take twenty seconds to admit it (see `HANDSHAKE_TIMEOUT_MS`).
    await page.routeWebSocket(/socket\.io/, () => {
      /* connected to nothing: no `connectToServer`, no answers */
    });

    await page.goto('/messages');

    await expect(page.getByText(t('chat.live.off'))).toBeVisible({
      timeout: 15_000,
    });
    // And it must not have claimed otherwise in the meantime.
    await expect(page.getByText(t('chat.live.on'))).toHaveCount(0);
    await expectNoRawKeys(page);
  });
});
