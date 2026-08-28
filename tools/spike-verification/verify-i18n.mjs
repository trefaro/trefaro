/**
 * Verifies the translation catalogue against a *running* deployment (chapter 4,
 * E22, E23).
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
 *   BASE=http://localhost:8080 node tools/spike-verification/verify-i18n.mjs
 *
 * Also writes and removes one `translation_override` row through `psql` in the
 * database container, which is the only way to prove the second half of E22
 * before AP 7 has built the screen for it: that a changed word takes effect on
 * the next request, with no rebuild and no restart.
 *
 *   POSTGRES_CONTAINER=trefaro-postgres  (default)
 *   POSTGRES_USER=trefaro  POSTGRES_DB=trefaro
 *
 * Skip that half with SKIP_OVERRIDE=1 if the database is not reachable by
 * `docker exec`; everything else still runs.
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
const CONTAINER = process.env.POSTGRES_CONTAINER ?? 'trefaro-postgres';
const DB_USER = process.env.POSTGRES_USER ?? 'trefaro';
const DB_NAME = process.env.POSTGRES_DB ?? 'trefaro';
const SKIP_OVERRIDE = process.env.SKIP_OVERRIDE === '1';

/** A key every shipped catalogue has, and its two shipped translations. */
const PROBE_KEY = 'modules.push.title';
const PROBE_EN = 'Push notifications';
const PROBE_DE = 'Push-Benachrichtigungen';
const PROBE_OVERRIDE = 'Push-Mitteilungen (verification)';

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

function sql(statement) {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-c', statement],
    { encoding: 'utf8' },
  );
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

// --- the instance can change a word ----------------------------------------

if (SKIP_OVERRIDE) {
  console.log('SKIP  an instance can change a word — SKIP_OVERRIDE=1');
} else {
  try {
    sql(
      `INSERT INTO translation_override (locale, key, value)
         VALUES ('de', '${PROBE_KEY}', '${PROBE_OVERRIDE}')
         ON CONFLICT (locale, key) DO UPDATE SET value = EXCLUDED.value`,
    );

    const overridden = await call('/api/i18n/de');
    check(
      'a stored translation takes effect on the next request',
      overridden.body?.[PROBE_KEY] === PROBE_OVERRIDE,
      String(overridden.body?.[PROBE_KEY]),
    );
    check(
      'and changes the ETag, so every client refetches',
      overridden.headers.get('etag') !== etag,
    );
    check(
      'without touching the other languages',
      (await call('/api/i18n/en')).body?.[PROBE_KEY] === PROBE_EN,
    );
  } finally {
    sql(
      `DELETE FROM translation_override WHERE locale = 'de' AND key = '${PROBE_KEY}'`,
    );
  }

  check(
    'removing it brings the shipped text back',
    (await call('/api/i18n/de')).body?.[PROBE_KEY] === PROBE_DE,
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
