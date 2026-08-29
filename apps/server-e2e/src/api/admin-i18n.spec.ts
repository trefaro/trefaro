import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the language administration (chapter 4, E23, E30) — AP 7.
 *
 * This is where the acceptance criterion of the work package is actually
 * demonstrated: a third language comes into being without anybody rebuilding an
 * image, its figure rises from nothing to a real value, both clients are offered
 * it, and taking the offer back leaves the translation where it was.
 *
 * It runs here rather than in a browser suite because `app_config.active_locales`
 * belongs to the whole instance: two Playwright workers changing the offered
 * languages would each see what the other just wrote. `apps/server-e2e` runs one
 * suite at a time (`maxWorkers: 1`), which is what makes writing an
 * instance-wide setting testable at all — the same reasoning as the module
 * switches in `modules.spec.ts`.
 *
 * The language it uses is Corsican (`co`): a real tag, so nothing has to pretend,
 * and one no shipped catalogue and no other suite touches.
 */
const LOCALE = 'co';

interface LocaleSummary {
  locale: string;
  shipped: boolean;
  active: boolean;
  isDefault: boolean;
  total: number;
  translated: number;
  overrides: number;
}

interface LocaleOverview {
  defaultLocale: string;
  locales: LocaleSummary[];
}

interface TranslationEntry {
  key: string;
  english: string;
  shipped: string | null;
  override: string | null;
  value: string;
  state: 'overridden' | 'shipped' | 'missing';
}

interface LocaleDetail extends LocaleSummary {
  entries: TranslationEntry[];
}

interface WriteResult {
  locale: string;
  written: number;
  reset: number;
  unchanged: number;
  ignored: string[];
  summary: LocaleSummary;
}

describe('the language administration', () => {
  const cookie = adminCookie();
  const asAdmin = { cookie };
  /**
   * A key of the shipped catalogue, taken from the instance rather than typed.
   *
   * Read from the deployment for the same reason `i18n.spec.ts` reads it: the
   * key list grows with every work package from AP 8 onward, and a suite that
   * named one would be a suite that has to be edited when the wording of a
   * screen changes.
   */
  let someKey: string;
  let keyCount: number;
  /** The shipped German text of that key — what "already there" means below. */
  let germanValue: string;

  beforeAll(async () => {
    const [english, german] = await Promise.all([
      api<Record<string, string>>('/api/i18n/en'),
      api<Record<string, string>>('/api/i18n/de'),
    ]);
    someKey = Object.keys(english.body).sort()[0];
    keyCount = Object.keys(english.body).length;
    germanValue = german.body[someKey];
  });

  afterAll(async () => {
    // Both halves of what this suite changed, and in this order: the offer
    // first, so a failure between the two leaves no language offered that
    // nothing translates. Cleanup has to tolerate a 404 — a failed test may
    // never have created what it is removing.
    await put('/api/admin/config/locales', {
      defaultLocale: 'en',
      activeLocales: ['en', 'de'],
    });
    await api(`/api/admin/i18n/${LOCALE}/${someKey}`, {
      method: 'DELETE',
      headers: asAdmin,
    });
  });

  function put<T = unknown>(path: string, payload: unknown) {
    return api<T>(path, {
      method: 'PUT',
      headers: { ...asAdmin, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  it('needs an administrative session', async () => {
    const anonymous = await api('/api/admin/i18n');

    expect(anonymous.status).toBe(401);
  });

  it('counts every shipped language against the English key list', async () => {
    const { status, body } = await api<LocaleOverview>('/api/admin/i18n', {
      headers: asAdmin,
    });

    expect(status).toBe(200);
    const english = body.locales.find((entry) => entry.locale === 'en');
    // English is the key list, so it is complete by definition — and the
    // denominator every other figure uses.
    expect(english).toMatchObject({ total: keyCount, translated: keyCount });
    const german = body.locales.find((entry) => entry.locale === 'de');
    expect(german).toMatchObject({ shipped: true, active: true });
    expect(german?.translated).toBe(keyCount);
  });

  it('answers for a language nothing knows yet', async () => {
    const { status, body } = await api<LocaleDetail>(
      `/api/admin/i18n/${LOCALE}`,
      { headers: asAdmin },
    );

    // Not a 404: a language is created by translating it (E30), so the editor
    // has to be able to open one that does not exist yet.
    expect(status).toBe(200);
    expect(body).toMatchObject({
      locale: LOCALE,
      shipped: false,
      active: false,
      translated: 0,
    });
    expect(body.entries).toHaveLength(keyCount);
    expect(body.entries.every((entry) => entry.state === 'missing')).toBe(true);
    // Every entry carries the English text, which is what a client receives
    // for it in the meantime (E23).
    expect(body.entries[0].value).toBe(body.entries[0].english);
  });

  it('refuses something that is not a language tag', async () => {
    const { status } = await api('/api/admin/i18n/not-a-tag-at-all', {
      headers: asAdmin,
    });

    expect(status).toBe(400);
  });

  it('creates a language by translating it, without a rebuild', async () => {
    const { status, body } = await put<WriteResult>(
      `/api/admin/i18n/${LOCALE}`,
      { entries: { [someKey]: 'Corsican text' } },
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ locale: LOCALE, written: 1, reset: 0 });
    // The figure rose from nothing to a real value — the acceptance criterion
    // of this work package, asserted rather than described.
    expect(body.summary.translated).toBe(1);
    expect(body.summary.total).toBe(keyCount);
  });

  it('imports what it understands and names the rest', async () => {
    const { body } = await put<WriteResult>(`/api/admin/i18n/${LOCALE}`, {
      entries: {
        [someKey]: 'Corsican text',
        'a.keyThisImageDoesNotHave': 'From another image',
      },
    });

    expect(body.unchanged).toBe(1);
    // Imported rather than refused: a file from an older or newer image is the
    // normal case for translation work done outside the application.
    expect(body.ignored).toEqual(['a.keyThisImageDoesNotHave']);
  });

  it('is not served publicly until the organization offers it', async () => {
    const { status } = await api(`/api/i18n/${LOCALE}`);

    // Translations exist, but nobody may pick the language yet — the two are
    // separate decisions (E30), and the public catalogue follows the offer.
    expect(status).toBe(404);
  });

  it('offers the language in both clients once it is saved', async () => {
    const written = await put<{ activeLocales: string[] }>(
      '/api/admin/config/locales',
      { defaultLocale: 'en', activeLocales: ['en', 'de', LOCALE] },
    );

    expect(written.status).toBe(200);
    expect(written.body.activeLocales).toEqual(['en', 'de', LOCALE]);

    // What both clients read on start: the language is in the list they build
    // their switcher from.
    const config = await api<{ availableLocales: string[] }>('/api/config');
    expect(config.body.availableLocales).toContain(LOCALE);

    // And the catalogue is now servable — the one translated key in Corsican,
    // every other key in English (E23).
    const catalogue = await api<Record<string, string>>(`/api/i18n/${LOCALE}`);
    expect(catalogue.status).toBe(200);
    expect(catalogue.body[someKey]).toBe('Corsican text');
    expect(Object.keys(catalogue.body)).toHaveLength(keyCount);
  });

  it('adds English back if it is left out', async () => {
    const { body } = await put<{
      activeLocales: string[];
      defaultLocale: string;
    }>('/api/admin/config/locales', {
      defaultLocale: LOCALE,
      activeLocales: [LOCALE],
    });

    // NFR 4 and E23: English is the last link of the resolution chain, so an
    // instance without it would leave every untranslated key with nothing to
    // fall back to.
    expect(body.activeLocales).toEqual(['en', LOCALE]);
    expect(body.defaultLocale).toBe(LOCALE);
  });

  it('refuses a default nobody is offered', async () => {
    const { status } = await put('/api/admin/config/locales', {
      defaultLocale: 'pt',
      activeLocales: ['en', 'de'],
    });

    expect(status).toBe(400);
  });

  it('keeps the translation when the language is no longer offered', async () => {
    await put('/api/admin/config/locales', {
      defaultLocale: 'en',
      activeLocales: ['en', 'de'],
    });

    const detail = await api<LocaleDetail>(`/api/admin/i18n/${LOCALE}`, {
      headers: asAdmin,
    });

    // The acceptance criterion's last clause: removing a locale from
    // `active_locales` deletes no work (E30). `translation_override` has no
    // foreign key to it for exactly this reason.
    expect(detail.body).toMatchObject({ active: false, translated: 1 });
    expect(
      detail.body.entries.find((entry) => entry.key === someKey),
    ).toMatchObject({ override: 'Corsican text', state: 'overridden' });
  });

  it('resets one key back to what the image ships', async () => {
    const { status, body } = await api<WriteResult>(
      `/api/admin/i18n/${LOCALE}/${someKey}`,
      { method: 'DELETE', headers: asAdmin },
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ reset: 1 });
    expect(body.summary.translated).toBe(0);
  });

  it('does not store a value that is what the image already ships', async () => {
    const english = await api<Record<string, string>>('/api/i18n/en');
    const { body } = await put<WriteResult>('/api/admin/i18n/de', {
      entries: { [someKey]: germanValue },
    });

    // A row repeating the image would pin the wording against the next image
    // (F74) — so writing back what is already there stores nothing.
    expect(body).toMatchObject({ written: 0, reset: 0, unchanged: 1 });
    expect(body.summary.overrides).toBe(0);
    // Untouched: the served catalogue still answers what it did before.
    const after = await api<Record<string, string>>('/api/i18n/de');
    expect(after.body[someKey]).toBe(germanValue);
    expect(after.body[someKey]).not.toBe(english.body[someKey]);
  });

  it('refuses a body with nothing in it', async () => {
    const { status } = await put(`/api/admin/i18n/${LOCALE}`, { entries: {} });

    expect(status).toBe(400);
  });

  it('is not reachable without the admin prefix', async () => {
    const { status } = await api('/api/i18n');

    // `/api/i18n/:locale` is public; the administration is not, and the guard
    // hangs on the path (E16). A bare `/api/i18n` is not a route at all.
    expect(status).toBe(404);
  });
});
