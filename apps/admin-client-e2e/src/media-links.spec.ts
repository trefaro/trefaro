import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE,
  SERIES_SLUG_PREFIX,
  fixtureLabel,
} from './support/admin-session';
import { t } from './support/catalogue';

/**
 * The media links of an event in the browser (FR 3.6, F10) — AP 11.
 *
 * What only a browser can show, beyond the API contract suite that covers the
 * rules:
 *
 * - **The address is a link that leaves the page**, with `target="_blank"` and
 *   `rel="noopener noreferrer"`. Nothing is embedded (F51), and those attributes
 *   are the difference — a payload cannot carry them.
 * - **An address that is not a web address is refused before it is sent.** The
 *   page says so, and the server never hears about it.
 * - **The kind is the order** (F52), which is a claim about what is rendered.
 *
 * The series and the event are seeded through the API with the browser's own
 * session; deleting the series takes the event and its links with it.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const EVENT_START = '2027-09-14T09:00:00+02:00';
const EVENT_END = '2027-09-14T18:00:00+02:00';

interface Seeded {
  seriesId: string;
  eventId: string;
  sessionId: string;
  sessionTitle: string;
}

async function seed(page: Page, label: string): Promise<Seeded> {
  const series = await page.request.post('/api/admin/series', {
    data: {
      name: `${SERIES_SLUG_PREFIX}media links ${label}`,
      description: 'Seeded by the organizer client media links spec.',
      status: 'published',
    },
  });
  expect(`${series.status()} ${await series.text()}`).toMatch(/^201/);
  const { id: seriesId } = (await series.json()) as { id: string };

  const event = await page.request.post(
    `/api/admin/series/${seriesId}/events`,
    {
      data: {
        name: `Media Links Event ${label}`,
        description: 'The event whose media links are managed here.',
        eventType: 'hybrid',
        startsAt: new Date(EVENT_START).toISOString(),
        endsAt: new Date(EVENT_END).toISOString(),
        timezone: 'Europe/Berlin',
        venueName: 'Bürgerhaus Kalk',
        onlineUrl: 'https://stream.example.org/media-links-event',
        languages: ['de'],
        status: 'published',
      },
    },
  );
  expect(`${event.status()} ${await event.text()}`).toMatch(/^201/);
  const { id: eventId } = (await event.json()) as { id: string };

  // One session, so the "belongs to" select has something to offer.
  const sessionTitle = 'Media Links Keynote';
  const session = await page.request.post(
    `/api/admin/events/${eventId}/program-items`,
    {
      data: {
        title: sessionTitle,
        startsAt: new Date('2027-09-14T10:00:00+02:00').toISOString(),
        endsAt: new Date('2027-09-14T11:00:00+02:00').toISOString(),
      },
    },
  );
  expect(`${session.status()} ${await session.text()}`).toMatch(/^201/);
  const { id: sessionId } = (await session.json()) as { id: string };

  return { seriesId, eventId, sessionId, sessionTitle };
}

test.describe('the media links of an event', () => {
  let seeded: Seeded = {
    seriesId: '',
    eventId: '',
    sessionId: '',
    sessionTitle: '',
  };

  test.beforeEach(async ({ page }, testInfo) => {
    seeded = await seed(page, fixtureLabel(testInfo.project.name));
  });

  test.afterEach(async ({ page }) => {
    if (seeded.seriesId) {
      await page.request.delete(`/api/admin/series/${seeded.seriesId}`);
    }
  });

  const open = (page: Page) =>
    page.goto(
      `/series/${seeded.seriesId}/events/${seeded.eventId}/media-links`,
    );

  const addForm = (page: Page) =>
    page.getByRole('region', { name: t('admin.mediaLinks.add'), exact: true });

  const rows = (page: Page) =>
    page
      .getByRole('region', { name: t('admin.mediaLinks.heading'), exact: true })
      .getByRole('listitem');

  /** Fills the add form and waits until the link is actually saved. */
  const add = async (
    page: Page,
    kind: string,
    title: string,
    url: string,
    belongsTo = 'The whole event',
  ): Promise<void> => {
    const form = addForm(page);
    await form
      .getByLabel(t('admin.mediaLinks.kind'))
      .selectOption({ label: kind });
    await form.getByLabel(t('admin.mediaLinks.linkTitle')).fill(title);
    await form.getByLabel(t('admin.mediaLinks.address')).fill(url);
    await form
      .getByLabel(t('admin.mediaLinks.belongsTo'))
      .selectOption({ label: belongsTo });
    await form
      .getByRole('button', { name: t('admin.mediaLinks.addSubmit') })
      .click();
    // The form clears itself once the server has answered; waiting for that
    // rather than for a row means the next fill cannot be wiped by the reset.
    await expect(form.getByLabel(t('admin.mediaLinks.linkTitle'))).toHaveValue(
      '',
    );
  };

  test('adds a link and shows it as a link that leaves the page', async ({
    page,
  }) => {
    await open(page);

    await add(
      page,
      'Recording',
      'Recording of the keynote',
      'https://tube.example.org/w/keynote',
    );

    await expect(rows(page)).toHaveCount(1);
    const target = rows(page).getByRole('link', {
      name: 'https://tube.example.org/w/keynote',
    });
    await expect(target).toBeVisible();
    // Not embedded, and following it does not tell the other side which
    // instance sent the visitor (NFR 9, F51).
    await expect(target).toHaveAttribute('target', '_blank');
    await expect(target).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(rows(page).first()).toContainText(
      t('mediaLinks.kind.recording.one'),
    );
  });

  test('shows them in the order participants read them, whatever the order they were added', async ({
    page,
  }) => {
    await open(page);

    await add(
      page,
      'Material',
      'Slides',
      'https://files.example.org/slides.pdf',
    );
    await add(
      page,
      'Live stream',
      'Watch live',
      'https://tube.example.org/live',
    );

    // The kind is the order: what is on now, then what can be read (F52).
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText(
      t('mediaLinks.kind.stream.one'),
    );
    await expect(rows(page).nth(1)).toContainText(
      t('mediaLinks.kind.material.one'),
    );
  });

  test('attaches a link to a session of this event', async ({ page }) => {
    await open(page);

    await add(
      page,
      'Recording',
      'Recording of the keynote',
      'https://tube.example.org/w/keynote',
      seeded.sessionTitle,
    );

    // Read back from the server, so what the row shows is what was stored —
    // both selects, which is what the marked-option binding is for.
    const row = rows(page).first();
    await expect(row.getByLabel(t('admin.mediaLinks.belongsTo'))).toHaveValue(
      seeded.sessionId,
    );
    await expect(row.getByLabel(t('admin.mediaLinks.kind'))).toHaveValue(
      'recording',
    );
  });

  test('refuses an address a click could not follow, without asking the server', async ({
    page,
  }) => {
    await open(page);

    const form = addForm(page);
    await form
      .getByLabel(t('admin.mediaLinks.kind'))
      .selectOption({ label: 'Recording' });
    await form
      .getByLabel(t('admin.mediaLinks.linkTitle'))
      .fill('Pasted the page title by mistake');
    await form
      .getByLabel(t('admin.mediaLinks.address'))
      .fill('tube.example.org/w/keynote');
    await form
      .getByRole('button', { name: t('admin.mediaLinks.addSubmit') })
      .click();

    await expect(page.getByRole('alert')).toContainText(
      t('admin.mediaLinks.errorUrl'),
    );
    await expect(rows(page)).toHaveCount(0);
    // Still typed, so the organizer can fix the address rather than retype it.
    await expect(form.getByLabel(t('admin.mediaLinks.linkTitle'))).toHaveValue(
      'Pasted the page title by mistake',
    );
  });

  test('removes a link once the question is answered', async ({ page }) => {
    await open(page);
    await add(
      page,
      'Material',
      'Slides',
      'https://files.example.org/slides.pdf',
    );

    page.once('dialog', (dialog) => void dialog.accept());
    await rows(page)
      .first()
      .getByRole('button', { name: t('admin.common.delete') })
      .click();

    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText(t('admin.mediaLinks.empty'))).toBeVisible();
  });

  test('is reachable from the event dashboard, which counts what is there', async ({
    page,
  }) => {
    await open(page);
    await add(
      page,
      'Live stream',
      'Watch live',
      'https://tube.example.org/live',
    );

    await page.goto(`/series/${seeded.seriesId}/events/${seeded.eventId}`);
    const tile = page
      .getByRole('article')
      .filter({ hasText: t('modules.mediaLinks.title') });
    await expect(tile).toContainText('1');
    await expect(tile).toContainText(
      t('admin.dashboard.metaCount', {
        count: 1,
        label: t('mediaLinks.kind.stream.one'),
      }),
    );

    await page
      .getByRole('link', { name: t('modules.mediaLinks.title') })
      .click();
    await expect(page).toHaveURL(/\/media-links$/);
  });
});
