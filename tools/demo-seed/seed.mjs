/**
 * Fills an instance with demo data, through the API a person would use.
 *
 *   node tools/demo-seed/seed.mjs                 # against http://localhost:8080
 *   node tools/demo-seed/seed.mjs --reset         # remove the demo data first
 *   node tools/demo-seed/seed.mjs --base http://localhost:3000
 *
 * Why not SQL: see the comment at the top of `api.mjs`. Why it needs the mailbox:
 * a confirmation, a personal self-service link and an objection are tokens that
 * only exist inside sent mail, so the states that depend on them can only be
 * reached by reading it. Without a reachable mailbox the seed still runs and says
 * which parts it left out.
 *
 * What it deliberately cannot make: an invitation in the `partial` state. That
 * needs a delivery to fail, and faking a failure would mean writing a row the
 * application would never write.
 */
import { Api, Mailbox, demoPdf, demoPng } from './api.mjs';
import {
  addressFor,
  APP_ICON,
  BRANDING,
  events,
  FORM_FIELDS,
  INVITATION,
  LOGO,
  MEDIA_LINKS,
  ORGANIZATIONS,
  ORIGINS,
  pastProgramme,
  PEOPLE,
  programme,
  SERIES,
  timeline,
  TRANSLATIONS,
} from './demo-data.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = flag('base', process.env.SEED_BASE ?? 'http://localhost:8080');
const MAILPIT = flag(
  'mailpit',
  process.env.SEED_MAILPIT ?? 'http://localhost:8025',
);
const EMAIL =
  process.env.SEED_ADMIN_EMAIL ?? process.env.ADMIN_BOOTSTRAP_EMAIL ?? '';
const PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
const RESET = args.includes('--reset');

const api = new Api(BASE);
const mailbox = new Mailbox(MAILPIT);
const say = (message) => console.log(message);

/** How the demo data is recognized again on a later run. */
const DEMO_SLUGS = Object.values(SERIES).map((series) => slugOf(series.name));

async function main() {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'No administrator credentials. Set SEED_ADMIN_EMAIL and ' +
        'SEED_ADMIN_PASSWORD, or ADMIN_BOOTSTRAP_EMAIL and ' +
        'ADMIN_BOOTSTRAP_PASSWORD (the pair a fresh instance was started with).',
    );
  }

  say(`Seeding ${BASE} as ${EMAIL}`);
  await api.login(EMAIL, PASSWORD);

  const withMail = await mailbox.reachable();
  if (!withMail) {
    say(
      `! ${MAILPIT} does not answer. Registrations will stay unconfirmed, and\n` +
        '  seats, the objection and the invitation are skipped — all three need a\n' +
        '  token that only exists in sent mail. Start Mailpit with\n' +
        '  `docker compose -f infra/docker-compose.dev.yml up -d mailpit`.',
    );
  }

  const existing = await findDemoSeries();
  if (existing.length > 0 && !RESET) {
    throw new Error(
      `The demo data is already there (${existing
        .map((series) => series.slug)
        .join(', ')}). Run with --reset to replace it, which deletes those ` +
        'series with everything below them.',
    );
  }
  if (existing.length > 0) {
    await removeDemoSeries(existing);
  }

  // --- the brand of the instance itself -----------------------------------
  //
  // Not demo *data* but the demo instance's own configuration, and it is set for
  // the same reason the data exists: a whitelabel application whose demo says
  // "Trefaro" in the header, in the tab, in every mail and on a home screen
  // demonstrates the opposite of what it is for (F60). Unlike everything below,
  // `--reset` does not take it back — there is nothing to restore it to, and an
  // instance being demonstrated is one that has a brand.
  await api.admin('PATCH', '/api/admin/config', BRANDING);
  await putImage('logo', LOGO, 'logo.png');
  await putImage('app-icon', APP_ICON, 'app-icon.png');
  say(
    `✓ branding: ${BRANDING.organizationName}, ${BRANDING.primaryColor}, ` +
      `a logo and a ${APP_ICON.width}×${APP_ICON.height} app icon`,
  );

  // --- series and events ---------------------------------------------------
  const series = {};
  for (const [key, input] of Object.entries(SERIES)) {
    series[key] = await api.admin('POST', '/api/admin/series', input);
  }
  say(`✓ ${Object.keys(series).length} series`);

  const dates = timeline();
  const created = {};
  for (const [key, { series: parent, ...input }] of Object.entries(
    events(dates),
  )) {
    created[key] = await api.admin(
      'POST',
      `/api/admin/series/${series[parent].id}/events`,
      input,
    );
  }
  say(
    `✓ ${Object.keys(created).length} events (one over, one draft, three types)`,
  );

  // --- the form of the main event -----------------------------------------
  const fields = [];
  for (const field of FORM_FIELDS) {
    fields.push(
      await api.admin(
        'POST',
        `/api/admin/events/${created.main.id}/registration-fields`,
        field,
      ),
    );
  }
  const keyOf = (label) => fields.find((field) => field.label === label).key;
  say(`✓ ${fields.length} form questions, all four types`);

  // --- programmes and media links -----------------------------------------
  const mainProgramme = [];
  for (const item of programme(dates)) {
    mainProgramme.push(
      await api.admin(
        'POST',
        `/api/admin/events/${created.main.id}/program-items`,
        item,
      ),
    );
  }
  const past = [];
  for (const item of pastProgramme(dates)) {
    past.push(
      await api.admin(
        'POST',
        `/api/admin/events/${created.kickoff.id}/program-items`,
        item,
      ),
    );
  }
  say(
    `✓ ${mainProgramme.length} programme items (two parallel, both with sign-up)`,
  );

  for (const { session, ...link } of MEDIA_LINKS.kickoff) {
    await api.admin(
      'POST',
      `/api/admin/events/${created.kickoff.id}/media-links`,
      {
        ...link,
        ...(session === undefined ? {} : { programItemId: past[session].id }),
      },
    );
  }
  for (const link of MEDIA_LINKS.main) {
    await api.admin(
      'POST',
      `/api/admin/events/${created.main.id}/media-links`,
      link,
    );
  }
  say(
    `✓ ${MEDIA_LINKS.kickoff.length + MEDIA_LINKS.main.length} media links, ` +
      'two of them on a session',
  );

  // --- the English side of it (FR 3.12) ------------------------------------
  //
  // Written per thing and per language, which is how the API takes them (F97):
  // the two published series, the two events that have content worth reading,
  // and five of the main event's sessions. What is left untranslated is left
  // untranslated on purpose — a visitor reading English then sees the German
  // original, which is what `?locale=` does when nobody has translated something
  // (F94) and the state every real organization is in for a while.
  let translated = 0;
  for (const [key, texts] of Object.entries(TRANSLATIONS.series)) {
    await api.admin(
      'PUT',
      `/api/admin/series/${series[key].id}/translations/${TRANSLATIONS.locale}`,
      texts,
    );
    translated += 1;
  }
  for (const [key, texts] of Object.entries(TRANSLATIONS.events)) {
    await api.admin(
      'PUT',
      `/api/admin/events/${created[key].id}/translations/${TRANSLATIONS.locale}`,
      texts,
    );
    translated += 1;
  }
  for (const item of mainProgramme) {
    const texts = TRANSLATIONS.programItems[item.title];
    if (!texts) continue;
    await api.admin(
      'PUT',
      `/api/admin/program-items/${item.id}/translations/${TRANSLATIONS.locale}`,
      texts,
    );
    translated += 1;
  }
  say(
    `✓ ${translated} things translated into ${TRANSLATIONS.locale}, ` +
      'and deliberately not all of them',
  );

  // --- registrations, through the public form ------------------------------
  const seriesSlug = series.citizens.slug;
  const eventSlug = created.main.slug;
  const path = `/api/user/series/${seriesSlug}/events/${eventSlug}/registrations`;
  const registered = [];

  for (const [index, [firstName, lastName]] of PEOPLE.entries()) {
    const email = addressFor(firstName, lastName);
    const organization = ORGANIZATIONS[index % ORGANIZATIONS.length];
    const payload = {
      firstName,
      lastName,
      email,
      phone: index % 5 === 0 ? `+49 30 ${1000000 + index * 137}` : null,
      origin: ORIGINS[index % ORIGINS.length],
      newsletterOptIn: index % 3 === 0,
      customFields: {
        ...(organization ? { [keyOf('Organisation')]: organization } : {}),
        [keyOf('Teilnahme')]: [
          'Vor Ort in Berlin',
          'Online',
          'Erst vor Ort, dann online',
        ][index % 3],
        [keyOf('Verpflegung')]: [
          'Keine Einschränkung',
          'Vegetarisch',
          'Vegan',
          'Glutenfrei',
        ][index % 4],
        [keyOf('Barrierefreier Zugang nötig')]: index % 11 === 0,
      },
    };

    // One of them brings a document, so the attachment feature has real bytes
    // and they arrive the way every attachment arrives: as `multipart/form-data`
    // with the file in a part named after its field key (F39).
    if (index === 2) {
      const form = new FormData();
      form.append('payload', JSON.stringify(payload));
      form.append(
        keyOf('Visa-Dokument'),
        new File(
          [
            new Uint8Array(
              demoPdf('Einladungsschreiben (Demo-Datei, kein echtes Dokument)'),
            ),
          ],
          'einladungsschreiben.pdf',
          { type: 'application/pdf' },
        ),
      );
      await api.form(path, form);
    } else {
      await api.user('POST', path, payload);
    }

    // Five stay pending: an unconfirmed registration is a state the overview has
    // to show, and the only honest way to have one is not to confirm it.
    registered.push({ email, confirm: index % 8 !== 5 });
  }
  say(
    `✓ ${registered.length} registrations through the public form, one with a document`,
  );

  if (!withMail) {
    say('Done, without the parts that need mail.');
    return summary(created, series, null);
  }

  const confirmed = [];
  for (const { email, confirm } of registered) {
    if (!confirm) continue;
    const token = await mailbox.confirmationToken(email);
    await api.user('POST', '/api/user/registrations/confirm', { token });
    confirmed.push(email);
  }
  say(`✓ ${confirmed.length} of them confirmed from the mailed link`);

  // --- four cancellations by the organizer, which notify (F59) -------------
  const cancelled = confirmed.slice(-4);
  for (const email of cancelled) {
    const id = await registrationIdOf(created.main.id, email);
    await api.admin('PATCH', `/api/admin/registrations/${id}`, {
      status: 'cancelled',
    });
  }
  say(
    `✓ ${cancelled.length} cancelled by the organizer — each one sent a notice`,
  );

  // --- seats, over the participants' own self-service links ----------------
  const workshops = mainProgramme.filter((item) => item.registrationEnabled);
  const small = workshops.reduce((a, b) => (a.capacity <= b.capacity ? a : b));
  const large = workshops.reduce((a, b) => (a.capacity >= b.capacity ? a : b));
  const takers = confirmed.filter((email) => !cancelled.includes(email));

  let seats = 0;
  for (const [index, email] of takers.slice(0, 7).entries()) {
    void index;
    const token = await mailbox.selfServiceToken(email);
    await api.user('PUT', `/api/user/program-items/${large.id}/signup`, {
      token,
    });
    seats += 1;
  }
  // Exactly the capacity, so the session reads as full and the next attempt is a
  // 409 decided by the database (F43).
  for (const email of takers.slice(10, 10 + small.capacity)) {
    const token = await mailbox.selfServiceToken(email);
    await api.user('PUT', `/api/user/program-items/${small.id}/signup`, {
      token,
    });
    seats += 1;
  }
  say(`✓ ${seats} seats — "${small.title}" is full at ${small.capacity}`);

  // --- one real invitation, and one real objection out of it ---------------
  const contacts = await api.admin(
    'GET',
    `/api/admin/series/${series.citizens.id}/contacts?pageSize=12`,
  );
  const invitation = await api.admin(
    'POST',
    `/api/admin/series/${series.citizens.id}/invitations`,
    {
      ...INVITATION,
      eventId: created.main.id,
      recipients: contacts.rows.map((contact) => contact.registrationId),
    },
  );
  const sent = await waitForInvitation(invitation.id, contacts.rows.length);
  say(`✓ one invitation sent to ${sent.sent} of ${sent.recipients} addresses`);

  // The objection comes out of the mail that was actually sent, and afterwards
  // that address is in no further list (E15, F57).
  const objector = contacts.rows[0].email;
  const objectionToken = await mailbox.objectionToken(objector);
  await api.user('POST', '/api/user/invitations/opt-out', {
    token: objectionToken,
  });
  say(`✓ ${objector} objected — from the link in their invitation`);

  return summary(created, series, sent);
}

/**
 * Uploads one of the two branding images, the way the design page does.
 *
 * `PUT` with a single file part named `file`, and the bytes are drawn here
 * rather than committed: the server decides what a file is from its first bytes
 * (F38) and reads the app icon's size out of the same header (F106), so a
 * generated PNG has to be a real one — which it is.
 */
async function putImage(kind, image, filename) {
  const bytes = demoPng(image.width, image.height, image.paint);
  const form = new FormData();
  form.append(
    'file',
    new File([new Uint8Array(bytes)], filename, { type: 'image/png' }),
  );
  await api.adminForm('PUT', `/api/admin/config/${kind}`, form);
}

/** Waits for the sender to work through the recipient rows (F56). */
async function waitForInvitation(id, recipients, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await api.admin('GET', `/api/admin/invitations/${id}`);
    if (latest.sent + latest.failed >= recipients) return latest;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return latest;
}

async function registrationIdOf(eventId, email) {
  const found = await api.admin(
    'GET',
    `/api/admin/events/${eventId}/registrations?search=${encodeURIComponent(email)}`,
  );
  const row = found.rows.find(
    (candidate) => candidate.email.toLowerCase() === email.toLowerCase(),
  );
  if (!row) throw new Error(`no registration for ${email}`);
  return row.id;
}

/**
 * The demo series that are already there, by slug.
 *
 * `GET /api/admin/series` answers a plain array: an organization has a handful of
 * series, so this is the one list in the application that is not paginated.
 */
async function findDemoSeries() {
  const all = await api.admin('GET', '/api/admin/series');
  return all.filter((series) => DEMO_SLUGS.includes(series.slug));
}

/**
 * Removes the demo data, innermost first.
 *
 * A series or event with a confirmed registration cannot be deleted (E14) — so
 * the registrations go first, then the events, then the series. That is also the
 * order the browser suites tear down in, and the reason `--reset` exists at all:
 * the series slug is unique, so a second run without it would collide.
 */
async function removeDemoSeries(series) {
  for (const one of series) {
    // Also a plain array — the events of one series, not of the instance.
    const events = await api.admin('GET', `/api/admin/series/${one.id}/events`);
    for (const event of events) {
      const registrations = await api.admin(
        'GET',
        `/api/admin/events/${event.id}/registrations?pageSize=200`,
      );
      for (const registration of registrations.rows ?? []) {
        await api.admin(
          'DELETE',
          `/api/admin/registrations/${registration.id}`,
        );
      }
      await api.admin('DELETE', `/api/admin/events/${event.id}`);
    }
    await api.admin('DELETE', `/api/admin/series/${one.id}`);
  }
  say(`✓ removed ${series.length} series from an earlier run`);
}

function summary(events, series, invitation) {
  say('');
  say('Where to look:');
  say(`  participant client   ${BASE}/`);
  say(`  organizer client     ${BASE}/admin/`);
  say(`  mailbox              ${MAILPIT}`);
  say('');
  say(
    `  the main event       ${BASE}/series/${series.citizens.slug}/events/${events.main.slug}`,
  );
  say(
    `  what it left behind  ${BASE}/series/${series.citizens.slug}/events/${events.kickoff.slug}`,
  );
  if (invitation) {
    say('');
    say(
      '  The invitation went out for real: the objection links in those mails work.',
    );
  }
}

/** Mirrors the server's slug rule closely enough to recognize its own data. */
function slugOf(name) {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

try {
  await main();
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
