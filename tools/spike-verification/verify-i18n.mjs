/**
 * Verifies the translation catalogue and the language administration against a
 * *running* deployment (chapter 4, E22, E23, E30).
 *
 * There is one class of defect here that no suite in this repository can see, and
 * it has bitten this project twice already in other shapes: a value that exists
 * in the source and never reaches the container. The catalogues live in three
 * places at once —
 *
 *   1. `libs/shared-i18n/catalogues/*.json`, the source of truth,
 *   2. the webpack `assets` entry that copies them into `dist/apps/server/assets/i18n`,
 *   3. the `COPY` in `infra/docker/server.Dockerfile`, plus `I18N_CATALOGUE_DIR`
 *
 * — and a missing one of the three produces an instance that answers `200` with
 * an empty object. Both clients then render their keys, every test stays green
 * (they run `nx serve` from the workspace, where the default path is the library
 * itself), and the CI builds the image without ever starting it.
 *
 *   BASE=http://localhost:8080 \
 *   ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… \
 *   node tools/spike-verification/verify-i18n.mjs
 *
 * The second half signs in and walks the whole of AP 7 through the API: it
 * creates a language nothing ships, translates one key, offers it to visitors,
 * checks that the public catalogue follows, takes the offer back, checks that the
 * translation survives, and resets it. That is the acceptance criterion of the
 * work package, run against a real deployment rather than against `nx serve` —
 * and it is also what proves the second half of E22, that a changed word takes
 * effect on the next request with no rebuild and no restart.
 *
 * It restores what it found: the language it uses (`ia`, Interlingua) is one no
 * image ships, and both the offer and the row are removed at the end.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? '';
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
const SESSION_COOKIE = 'trefaro_admin_session';

/** A key every shipped catalogue has, and its two shipped translations. */
const PROBE_KEY = 'modules.push.title';
const PROBE_EN = 'Push notifications';
const PROBE_DE = 'Push-Benachrichtigungen';
const PROBE_OVERRIDE = 'Push-Mitteilungen (verification)';

/**
 * The language this script brings into being and takes away again.
 *
 * Interlingua: a real tag, so nothing has to pretend, and one no image ships and
 * no suite in this repository touches.
 */
const NEW_LOCALE = 'ia';
const NEW_TEXT = 'Notificationes push';

let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

async function call(path, init) {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: response.status, body, headers: response.headers };
}

let cookie = '';

/** A JSON request as the administrator, once there is a session. */
function send(method, path, payload) {
  return call(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

// --- the catalogue is inside this deployment -------------------------------

const config = await call('/api/config');
check(
  'the instance offers more than one language',
  Array.isArray(config.body?.availableLocales) &&
    config.body.availableLocales.length > 1,
  JSON.stringify(config.body?.availableLocales),
);

const english = await call('/api/i18n/en');
check(
  'the catalogue answers without authentication',
  english.status === 200,
  `status ${english.status}`,
);
check(
  'and it is not empty',
  // The whole reason this script exists: an image whose build or Dockerfile
  // dropped the assets answers 200 with `{}`, and both clients render keys.
  Object.keys(english.body ?? {}).length > 0,
  `${Object.keys(english.body ?? {}).length} key(s)`,
);
check(
  'it carries the text this image ships',
  english.body?.[PROBE_KEY] === PROBE_EN,
  String(english.body?.[PROBE_KEY]),
);
check(
  'it is flat, with one string per dotted key',
  Object.entries(english.body ?? {}).every(
    ([key, value]) => typeof value === 'string' && key.includes('.'),
  ),
);

const german = await call('/api/i18n/de');
check(
  'German is served and translated',
  german.body?.[PROBE_KEY] === PROBE_DE,
  String(german.body?.[PROBE_KEY]),
);
check(
  'every language answers the whole English key list (E23)',
  Object.keys(english.body ?? {}).every((key) => key in (german.body ?? {})),
);

// --- the keys the module administration hands out ---------------------------

for (const plugin of config.body?.plugins ?? []) {
  check(
    `the plug-in "${plugin.key}" has a name in the catalogue`,
    typeof english.body?.[plugin.labelKey] === 'string',
    plugin.labelKey,
  );
}

// --- revalidation -----------------------------------------------------------

const etag = german.headers.get('etag');
check('the catalogue carries an ETag', Boolean(etag), String(etag));
check(
  'a client that has it gets 304',
  (await call('/api/i18n/de', { headers: { 'if-none-match': etag ?? '' } }))
    .status === 304,
);
check(
  'and is told to revalidate rather than to cache',
  (german.headers.get('cache-control') ?? '').includes('no-cache'),
  String(german.headers.get('cache-control')),
);

// --- the language administration (AP 7) -------------------------------------

if (!EMAIL || !PASSWORD) {
  console.log(
    'SKIP  the language administration — set ADMIN_BOOTSTRAP_EMAIL and ' +
      'ADMIN_BOOTSTRAP_PASSWORD to run it',
  );
} else {
  const login = await send('POST', '/api/admin/auth/login', {
    email: EMAIL,
    password: PASSWORD,
  });
  for (const header of login.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === SESSION_COOKIE)
      cookie = `${SESSION_COOKIE}=${rest.join('=')}`;
  }
  check(
    'an administrative session is established',
    Boolean(cookie),
    `status ${login.status}`,
  );
}

if (cookie) {
  const before = await send('GET', '/api/admin/i18n');
  const keyCount = Object.keys(english.body ?? {}).length;
  const englishRow = (before.body?.locales ?? []).find(
    (row) => row.locale === 'en',
  );
  check(
    'English counts as complete, and is the denominator',
    englishRow?.total === keyCount && englishRow?.translated === keyCount,
    JSON.stringify(englishRow),
  );

  const storedLocales = {
    defaultLocale: before.body?.defaultLocale ?? 'en',
    activeLocales: (before.body?.locales ?? [])
      .filter((row) => row.active)
      .map((row) => row.locale),
  };

  try {
    const empty = await send('GET', `/api/admin/i18n/${NEW_LOCALE}`);
    check(
      'a language nothing knows yet can still be opened (E30)',
      empty.status === 200 && empty.body?.translated === 0,
      `status ${empty.status}`,
    );

    const written = await send('PUT', `/api/admin/i18n/${NEW_LOCALE}`, {
      entries: { [PROBE_KEY]: NEW_TEXT },
    });
    check(
      'a third language comes into being by being translated',
      written.body?.written === 1 && written.body?.summary?.translated === 1,
      JSON.stringify(written.body?.summary),
    );

    check(
      'and is not public until the organization offers it',
      (await call(`/api/i18n/${NEW_LOCALE}`)).status === 404,
    );

    const offered = await send('PUT', '/api/admin/config/locales', {
      defaultLocale: storedLocales.defaultLocale,
      activeLocales: [...storedLocales.activeLocales, NEW_LOCALE],
    });
    check(
      'offering it puts it in what both clients read on start',
      (await call('/api/config')).body?.availableLocales?.includes(NEW_LOCALE),
      JSON.stringify(offered.body?.activeLocales),
    );

    const served = await call(`/api/i18n/${NEW_LOCALE}`);
    check(
      'its catalogue is the translated key and English for the rest (E23)',
      served.body?.[PROBE_KEY] === NEW_TEXT &&
        Object.keys(served.body ?? {}).length === keyCount,
      String(served.body?.[PROBE_KEY]),
    );

    const overridden = await send('PUT', '/api/admin/i18n/de', {
      entries: { [PROBE_KEY]: PROBE_OVERRIDE },
    });
    const afterOverride = await call('/api/i18n/de');
    check(
      'a changed word takes effect on the next request, with no rebuild',
      overridden.body?.written === 1 &&
        afterOverride.body?.[PROBE_KEY] === PROBE_OVERRIDE,
      String(afterOverride.body?.[PROBE_KEY]),
    );
    check(
      'and changes the ETag, so every client refetches',
      afterOverride.headers.get('etag') !== etag,
    );
    check(
      'without touching the other languages',
      (await call('/api/i18n/en')).body?.[PROBE_KEY] === PROBE_EN,
    );

    const reset = await send(
      'DELETE',
      `/api/admin/i18n/de/${encodeURIComponent(PROBE_KEY)}`,
    );
    check(
      'resetting a key brings the shipped text back',
      reset.body?.reset === 1 &&
        (await call('/api/i18n/de')).body?.[PROBE_KEY] === PROBE_DE,
    );
  } finally {
    await send('PUT', '/api/admin/config/locales', storedLocales);
    await send('DELETE', `/api/admin/i18n/de/${encodeURIComponent(PROBE_KEY)}`);
  }

  const stillThere = await send('GET', `/api/admin/i18n/${NEW_LOCALE}`);
  check(
    'taking the offer back deletes no translation (E30)',
    stillThere.body?.active === false && stillThere.body?.translated === 1,
    JSON.stringify({
      active: stillThere.body?.active,
      translated: stillThere.body?.translated,
    }),
  );

  await send(
    'DELETE',
    `/api/admin/i18n/${NEW_LOCALE}/${encodeURIComponent(PROBE_KEY)}`,
  );
  const removed = await send('GET', `/api/admin/i18n/${NEW_LOCALE}`);
  check(
    'and this script leaves the instance as it found it',
    removed.body?.translated === 0 &&
      !(await call('/api/config')).body?.availableLocales?.includes(NEW_LOCALE),
  );
}

// --- what must not answer ---------------------------------------------------

check(
  'a language this instance does not serve is a 404',
  (await call('/api/i18n/pt')).status === 404,
);
check(
  'something that is not a language tag is a 400',
  (await call('/api/i18n/not-a-language-tag-at-all')).status === 400,
);

console.log(
  failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
