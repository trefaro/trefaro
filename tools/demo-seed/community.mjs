/**
 * The second half of the seed: the community, and the five plug-ins.
 *
 * Everything in `seed.mjs` is what an organizer builds — series, events, a
 * form, a programme, registrations. This is what a community does with it:
 * accounts with profiles, a searchable directory, conversations, a forum with a
 * queue, programme proposals in all four states, rooms with one that is too
 * small, personal plans and people who have arrived at the door.
 *
 * It exists because of the usability test of phase 5, which asks about exactly
 * the use cases the thesis never tested. A facilitator who first has to invent
 * five profiles before the participant search can be tried is asking this
 * repository a question, and that test is meant to run without one.
 *
 * Same rule as the rest of the seed: **through the API, never through the
 * database.** So an account is confirmed because somebody followed the link in
 * its mail, a forum post is approved because the organizer approved it, and a
 * ticket is scanned with the code the plug-in issued — none of these states can
 * be written here without the application agreeing to them.
 *
 * Two indexes are easy to confuse and are not the same: `person` indexes
 * `PEOPLE` (the forty who registered), while `author`, `account`, `from` and
 * `to` index `ACCOUNTS` (the ten of them who made an account).
 */

import { Participant } from './api.mjs';
import {
  ACCOUNTS,
  addressFor,
  CONTACT_ENQUIRIES,
  CONVERSATIONS,
  DEMO_PASSWORD,
  FORUM_THREADS,
  PEOPLE,
  PERSONAL_PLANS,
  PROFILE_QUESTIONS,
  PROPOSALS,
  ROOMS,
} from './demo-data.mjs';

/**
 * The modules the demo instance needs that a fresh one does not start with.
 *
 * The five plug-ins are all `enabledByDefault: false` — a curated plug-in is
 * something an organization switches on, not something it finds switched on
 * (F47). `newsletter-opt-in` joins them because the registrations above already
 * carry opt-ins, and a list nobody can open is data that might as well not be
 * there.
 *
 * `push` stays off on purpose: it needs VAPID keys in the environment and a
 * real device to mean anything, and an instance that offers a notification it
 * cannot send is worse than one that does not offer it.
 *
 * Like the branding, this is the instance's **configuration** and `--reset`
 * does not take it back. There is nothing to take it back to.
 */
const MODULES = [
  'newsletter-opt-in',
  'program-proposals',
  'forum',
  'room-planning',
  'qr-checkin',
  'personal-program',
];

/**
 * Writes the community half against an instance that already has the rest.
 *
 * Returns what it made, so the summary can say where to look.
 */
export async function seedCommunity({
  api,
  mailbox,
  base,
  say,
  mainEvent,
  seriesSlug,
  eventSlug,
  programme,
  confirmed,
  password = DEMO_PASSWORD,
}) {
  // --- the switches ---------------------------------------------------------
  for (const key of MODULES) {
    await api.admin('PATCH', `/api/admin/modules/${key}`, { enabled: true });
  }
  say(`✓ ${MODULES.length} modules switched on, push deliberately not`);

  // --- the instance's profile questions (E35) -------------------------------
  //
  // Asked for first, because these are not below a series either: `--reset`
  // removes the demo events, and a question every profile has already answered
  // survives that. Adding them again would give the form three more of the
  // same, which is how a demo instance starts looking like a bug report.
  const existing = await api.admin('GET', '/api/admin/profile-fields');
  const questions = [...existing];
  let added = 0;
  for (const question of PROFILE_QUESTIONS) {
    if (questions.some((field) => field.label === question.label)) continue;
    questions.push(
      await api.admin('POST', '/api/admin/profile-fields', question),
    );
    added += 1;
  }
  const questionKey = (label) =>
    questions.find((question) => question.label === label).key;
  say(
    added === PROFILE_QUESTIONS.length
      ? `✓ ${added} profile questions, one of each type`
      : `✓ ${PROFILE_QUESTIONS.length} profile questions (${added} added, the rest were there)`,
  );

  // --- accounts, each one confirmed from its own mail (E32) -----------------
  //
  // `--reset` removes the series and everything below it, and the plug-in rows
  // go with the events they belong to — but an **account is not below a
  // series.** It belongs to a person, who did not stop existing because a demo
  // event did, and nothing in this application lets an administrator delete
  // somebody else's account (E65, deliberately). So a second run signs in as
  // the accounts already there instead of registering them again.
  //
  // Asked once rather than per account, and the reason is a budget: the login
  // route allows twenty attempts per five minutes per client address, and this
  // run already spends one on the administrator. Ten accounts probed
  // individually would be twenty-one attempts in the worst case, which is one
  // too many for a tool to spend finding something out. They are created
  // together, so either all ten are there or none is.
  const reused = await signIn(base, ACCOUNTS[0], password);
  if (reused) {
    say(
      '· the demo accounts are already there — signing in instead of registering',
    );
  }

  const sessions = [];
  for (const account of ACCOUNTS) {
    const [firstName, lastName] = PEOPLE[account.person];
    const email = addressFor(firstName, lastName);

    let session = account === ACCOUNTS[0] ? reused : null;
    if (!session && reused) {
      session = await new Participant(base).login(email, password);
    }
    if (!session) {
      await api.user('POST', '/api/user/profiles', {
        email,
        password,
        firstName,
        lastName,
        preferredLocale: 'de',
      });
      const token = await mailbox.profileConfirmationToken(email);
      await api.user('POST', '/api/user/profiles/confirm', { token });
      session = await new Participant(base).login(email, password);
    }

    await session.request('PATCH', '/api/participant/me', {
      activityAreas: account.activityAreas,
      searchable: account.searchable,
      customFields: {
        [questionKey('Ortsgruppe')]: account.answers.Ortsgruppe,
        [questionKey('Sprachen')]: account.answers.Sprachen,
        [questionKey('Ich moderiere gern')]: account.moderates === true,
      },
    });
    sessions.push(session);
  }
  const findable = ACCOUNTS.filter((account) => account.searchable).length;
  say(
    `✓ ${sessions.length} participant accounts, ${findable} of them findable ` +
      `— the other ${sessions.length - findable} did not tick the box (E37)`,
  );

  // --- conversations between participants (FR 4.5) --------------------------
  //
  // Started by the sender and answered by the other side, so the unread mark of
  // the last one is unread because nobody opened it — not because a column says
  // so. `PUT :id/read` is what opening a conversation does, and the seed calls
  // it for every conversation but the one that is meant to look new.
  let messages = 0;
  for (const conversation of CONVERSATIONS) {
    const opener = sessions[conversation.from];
    const other = sessions[conversation.to];
    const { id } = await opener.request(
      'POST',
      '/api/participant/conversations',
      {
        profileId: other.me.id,
      },
    );

    // The endpoint means "the conversation with this person" and two people
    // have exactly one of those, so a second run finds the first run's. Its
    // messages are still in it — appending them again would make the demo
    // instance stutter, which is a thing a tester would report.
    const already = await opener.request(
      'GET',
      `/api/participant/conversations/${id}/messages`,
    );
    if (already.rows.length > 0) continue;

    for (const [index, body] of conversation.messages.entries()) {
      const writer = index % 2 === 0 ? opener : other;
      await writer.request(
        'POST',
        `/api/participant/conversations/${id}/messages`,
        { body },
      );
      messages += 1;
    }

    if (!conversation.unread) {
      await other.request('PUT', `/api/participant/conversations/${id}/read`);
      await opener.request('PUT', `/api/participant/conversations/${id}/read`);
    }
  }
  say(
    messages === 0
      ? `✓ ${CONVERSATIONS.length} conversations, already written in an earlier run`
      : `✓ ${CONVERSATIONS.length} conversations with ${messages} messages, one unread`,
  );

  // --- two questions from people without an account (FR 1.3, E39) -----------
  for (const enquiry of CONTACT_ENQUIRIES) {
    await api.user(
      'POST',
      `/api/user/series/${seriesSlug}/events/${eventSlug}/contact`,
      enquiry,
    );
  }
  say(
    `✓ ${CONTACT_ENQUIRIES.length} enquiries from people who did not register`,
  );

  // --- the forum, with a queue left in it (FR 4.6) --------------------------
  let approved = 0;
  let pending = 0;
  for (const thread of FORUM_THREADS) {
    const opened = await sessions[thread.author].request(
      'POST',
      `/api/participant/plugins/forum/events/${mainEvent.id}/threads`,
      { title: thread.title, body: thread.body },
    );
    await api.admin(
      'POST',
      `/api/admin/plugins/forum/posts/${opened.post.id}/approval`,
    );
    approved += 1;

    for (const reply of thread.replies) {
      const post = await sessions[reply.author].request(
        'POST',
        `/api/participant/plugins/forum/threads/${opened.thread.id}/posts`,
        { body: reply.body },
      );
      if (reply.pending) {
        pending += 1;
        continue;
      }
      await api.admin(
        'POST',
        `/api/admin/plugins/forum/posts/${post.id}/approval`,
      );
      approved += 1;
    }
  }
  say(
    `✓ ${FORUM_THREADS.length} forum threads — ${approved} posts approved, ` +
      `${pending} still waiting for a decision`,
  );

  // --- programme proposals in all four states (FR 3.13, FR 3.14) -----------
  let decided = 0;
  for (const proposal of PROPOSALS) {
    const created = await sessions[proposal.author].request(
      'POST',
      `/api/participant/plugins/program-proposals/events/${mainEvent.id}/proposals`,
      { title: proposal.title, description: proposal.description },
    );
    if (!proposal.decide) continue;
    await api.admin(
      'POST',
      `/api/admin/plugins/program-proposals/proposals/${created.id}/` +
        (proposal.decide === 'approve' ? 'approval' : 'rejection'),
    );
    decided += 1;
  }
  say(
    `✓ ${PROPOSALS.length} programme proposals, ${decided} decided and ` +
      `${PROPOSALS.length - decided} in the queue`,
  );

  // --- rooms, one of them too small (FR 3.11, F21) --------------------------
  const itemId = (title) => {
    const item = programme.find((candidate) => candidate.title === title);
    if (!item) throw new Error(`no programme item called "${title}"`);
    return item.id;
  };
  let placements = 0;
  for (const room of ROOMS) {
    const { sessions: titles, ...input } = room;
    const created = await api.admin(
      'POST',
      `/api/admin/plugins/room-planning/events/${mainEvent.id}/rooms`,
      input,
    );
    for (const title of titles) {
      await api.admin(
        'PUT',
        `/api/admin/plugins/room-planning/program-items/${itemId(title)}/rooms/${created.id}`,
      );
      placements += 1;
    }
  }
  // Read back rather than asserted: the warning is computed when the plan is
  // read and stored nowhere (E50), so the only way to know the demo instance
  // really shows one is to ask it.
  const plan = await api.admin(
    'GET',
    `/api/admin/plugins/room-planning/events/${mainEvent.id}/schedule`,
  );
  const overbooked = plan.rooms
    .flatMap((entry) => entry.bookings)
    .filter((booking) => booking.warnings.includes('overbooked')).length;
  say(
    `✓ ${ROOMS.length} rooms with ${placements} sessions placed — ` +
      `${overbooked} of them overbooked, which is the point`,
  );

  // --- personal programme plans (FR 3.17) ----------------------------------
  let planned = 0;
  for (const plan of PERSONAL_PLANS) {
    for (const title of plan.sessions) {
      await sessions[plan.account].request(
        'PUT',
        `/api/participant/plugins/personal-program/program-items/${itemId(title)}`,
      );
      planned += 1;
    }
  }
  say(
    `✓ ${planned} sessions in the plans of ${PERSONAL_PLANS.length} participants`,
  );

  // --- people who have arrived at the door (FR 3.16) -----------------------
  //
  // The code is the plug-in's own, issued per registration and never the signed
  // self-service token (E53) — so the seed reads the ticket the way a
  // participant's browser does, from the personal link in their receipt, and
  // then scans it the way the door does.
  let admitted = 0;
  for (const email of confirmed.slice(0, 6)) {
    const token = await mailbox.selfServiceToken(email);
    const ticket = await api.user(
      'GET',
      `/api/user/plugins/qr-checkin/ticket?token=${encodeURIComponent(token)}`,
    );
    await api.admin('POST', '/api/admin/plugins/qr-checkin/checkins', {
      code: ticket.code,
    });
    admitted += 1;
  }
  say(`✓ ${admitted} participants checked in, the rest still expected`);

  return { accounts: sessions.length, password };
}

/**
 * Signs in if the account is there, and says nothing louder than `null` if not.
 *
 * A wrong password and an unknown address answer the same way on purpose (the
 * form must not become a way to find out who has an account here), which is
 * exactly what this needs: "no session" is the answer, and the reason is not
 * this tool's business.
 */
async function signIn(base, account, password) {
  const [firstName, lastName] = PEOPLE[account.person];
  try {
    return await new Participant(base).login(
      addressFor(firstName, lastName),
      password,
    );
  } catch {
    return null;
  }
}
