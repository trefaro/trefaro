import { io, type Socket } from 'socket.io-client';
import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import {
  closeDatabase,
  deleteConversations,
  deletePushSubscriptions,
  deleteProfiles,
  deleteRegistrations,
  pushSubscriptionOwner,
  seedProfile,
  seedRegistrations,
  seedSession,
} from '../support/database';
import {
  startPushSink,
  type PushDevice,
  type PushSink,
} from '../support/push-sink';

/**
 * Contract of AP 11: push becomes real (FR 3.15 — E43, E44, F176).
 *
 * Everything except the last hop. A push service is played by a socket per
 * device (`support/push-sink.ts`), so the audience query, the two switches and
 * the whole path from an organizer's edit to an outgoing notification really
 * run; that one then appears on a phone is the device matrix in
 * `docs/spikes/03-web-push.md`, and it needs a person and four devices.
 *
 * What is decided here:
 *
 * 1. **A subscription may belong to nobody, and follows the session when it
 *    does** (E43). Posted with a cookie it is bound to that account, posted
 *    without one it is unbound — the same endpoint, because the endpoint is
 *    the identity of the row and a shared device must stop carrying somebody's
 *    messages when they leave.
 * 2. **Who hears about a changed event.** The confirmed registrants' devices
 *    and every device without an account; not an account that is signed in
 *    and not registered for it.
 * 3. **What counts as a change** (F176): the time, the place, and that it is
 *    off. Not a description, not a draft, and nothing at all about an event
 *    that is over.
 * 4. **A new message notifies the member who is not watching, and not the one
 *    who is** (E44) — with a real socket in a real room, which is the half the
 *    unit tests replace with a fake.
 * 5. **Both switches are asked**: no VAPID key pair, or the `push` module off,
 *    and nothing goes out although the subscriptions are still there (F63).
 *
 * A "notification" here is a connection to the device's own listening socket,
 * for the reason `support/push-sink.ts` spells out: `web-push` always speaks
 * TLS, and a sink with a certificate the server trusts would mean weakening
 * production code or the server's environment for a test. So this file decides
 * **who** is notified; what a notification says is decided in
 * `push-texts.spec.ts`, and that a `410 Gone` clears a subscription in
 * `push.service.spec.ts`.
 *
 * **No logins.** The instance allows twenty in five minutes (E4) and the
 * account suites already use most of them, so the sessions are seeded like
 * every other suite that needs more than one — a session is a hashed token in
 * a row, and nothing can tell how the row got there.
 *
 * **A VAPID key pair is required** for this file, as it is for
 * `tools/spike-verification/verify-push.mjs`: without one the instance has
 * push switched off at the source and there is nothing to assert. The first
 * test says so in one sentence rather than failing eight times.
 */
const USER_SESSION_COOKIE = 'trefaro_user_session';
const stamp = Date.now();
const DOMAIN = `@push-${stamp}.example.org`;
const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;
const CHAT_NAMESPACE = '/chat';
const REALTIME_PATH = '/api/socket.io';

interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
}

interface Conversation {
  id: string;
}

const EVENT = {
  description: 'The event whose audience hears about a change.',
  eventType: 'onsite',
  startsAt: '2099-06-18T08:00:00.000Z',
  endsAt: '2099-06-18T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

/**
 * Longer than the default five seconds, and unavoidably so: a notification is
 * not awaited by the request that causes it, so every assertion here waits for
 * something to arrive — or waits to be sure nothing does.
 */
jest.setTimeout(30_000);

describe('push notifications', () => {
  let cookie = '';
  let sink: PushSink;
  let series: Series;
  /** Published and in the future: the only event anybody is notified about. */
  let event: Event;
  /** Published, but already over — archiving it is housekeeping (F176). */
  let past: Event;
  let draft: Event;

  /** A confirmed registrant with an account, and their device. */
  const registrant = { id: '', session: '' };
  let registrantDevice: PushDevice;
  /** An account that is signed in and registered for nothing. */
  const stranger = { id: '', session: '' };
  let strangerDevice: PushDevice;
  /** A browser that never signed in — in every event's audience (E43). */
  let anonymousDevice: PushDevice;

  /**
   * The flags as this instance had them, or `null` while they are unknown.
   *
   * `null` rather than a default, because a teardown that runs after a failed
   * `beforeAll` would otherwise *set* the guess: an early crash here once left
   * `push` switched on in the development instance, which then broke a
   * completely different suite — the organizer's module page, whose one
   * writing test clicks "enable" and finds nothing to click. A suite may only
   * put back what it read.
   */
  let pushWasEnabled: boolean | null = null;
  let chatWasEnabled: boolean | null = null;
  /** Conversations this suite opened, for the teardown. */
  const conversations: string[] = [];
  /** Sockets it opened, so none of them keeps Jest alive. */
  const sockets: Socket[] = [];

  const asAdmin = (method: string, payload?: unknown) => ({
    method,
    headers: {
      cookie,
      ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });

  const setModule = (key: string, enabled: boolean) =>
    api(`/api/admin/modules/${key}`, asAdmin('PATCH', { enabled }));

  const moduleEnabled = async (key: string): Promise<boolean> => {
    const { body } = await api<{ key: string; enabled: boolean }[]>(
      '/api/admin/modules',
      asAdmin('GET'),
    );
    return body.find((one) => one.key === key)?.enabled ?? false;
  };

  const subscribe = (device: PushDevice, session?: string) =>
    api('/api/user/push/subscriptions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(session ? { cookie: `${USER_SESSION_COOKIE}=${session}` } : {}),
      },
      body: JSON.stringify({
        endpoint: device.endpoint,
        keys: device.keys,
      }),
    });

  const unsubscribe = (device: PushDevice) =>
    api('/api/user/push/subscriptions', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: device.endpoint }),
    });

  const patchEvent = (id: string, payload: unknown) =>
    api(`/api/admin/events/${id}`, asAdmin('PATCH', payload));

  const createEvent = (name: string, overrides: Record<string, unknown> = {}) =>
    api<Event>(
      `/api/admin/series/${series.id}/events`,
      asAdmin('POST', { ...EVENT, name, ...overrides }),
    );

  beforeAll(async () => {
    cookie = adminCookie();
    sink = await startPushSink();

    pushWasEnabled = await moduleEnabled('push');
    chatWasEnabled = await moduleEnabled('chat');
    await setModule('push', true);
    await setModule('chat', true);

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdmin('POST', {
          name: `Push Contract Series ${stamp}`,
          description: 'Holds the events these notifications are about.',
          status: 'published',
        }),
      )
    ).body;

    event = (await createEvent(`Push Contract Event ${stamp}`)).body;
    past = (
      await createEvent(`Push Contract Past ${stamp}`, {
        startsAt: '2020-06-18T08:00:00.000Z',
        endsAt: '2020-06-18T15:00:00.000Z',
      })
    ).body;
    draft = (
      await createEvent(`Push Contract Draft ${stamp}`, { status: 'draft' })
    ).body;

    // Two accounts, both findable, because starting a conversation asks for
    // exactly that (E37) and E44 needs one to run in.
    registrant.id = await seedProfile({
      email: `amina${DOMAIN}`,
      firstName: 'Amina',
      lastName: 'Okonkwo',
      searchable: true,
    });
    registrant.session = await seedSession(registrant.id);
    await seedRegistrations(event.id, [
      {
        email: `amina${DOMAIN}`,
        firstName: 'Amina',
        lastName: 'Okonkwo',
        status: 'confirmed',
      },
    ]);

    stranger.id = await seedProfile({
      email: `bo${DOMAIN}`,
      firstName: 'Bo',
      lastName: 'Lindgren',
      searchable: true,
    });
    stranger.session = await seedSession(stranger.id);

    registrantDevice = await sink.device('registrant');
    strangerDevice = await sink.device('stranger');
    anonymousDevice = await sink.device('anonymous');

    await subscribe(registrantDevice, registrant.session);
    await subscribe(strangerDevice, stranger.session);
    await subscribe(anonymousDevice);
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await deletePushSubscriptions('http://127.0.0.1');
    await deleteConversations(conversations);
    for (const one of [event, past, draft]) {
      if (one) await deleteRegistrations(one.id);
    }
    await deleteProfiles(DOMAIN);
    if (series) {
      await api(`/api/admin/series/${series.id}`, asAdmin('DELETE'));
    }
    if (pushWasEnabled !== null) await setModule('push', pushWasEnabled);
    if (chatWasEnabled !== null) await setModule('chat', chatWasEnabled);
    await sink.close();
    await closeDatabase();
  });

  beforeEach(() => sink.forget());

  it('is configured on this instance — otherwise nothing below can be asserted', async () => {
    const { body } = await api<{ webPushPublicKey: string | null }>(
      '/api/config',
    );

    expect(typeof body.webPushPublicKey).toBe('string');
  });

  describe('whose device it is (E43)', () => {
    it('binds a subscription to the session that posted it', async () => {
      expect(await pushSubscriptionOwner(registrantDevice.endpoint)).toBe(
        registrant.id,
      );
    });

    it('stores one without a session, and leaves it to nobody', async () => {
      // The whole of E43: a browser that never registered for anything keeps
      // its subscription, because a moved event is public information.
      expect(await pushSubscriptionOwner(anonymousDevice.endpoint)).toBeNull();
    });

    it('rebinds the same browser rather than storing it twice', async () => {
      const device = await sink.device('rebound');

      await subscribe(device, registrant.session);
      expect(await pushSubscriptionOwner(device.endpoint)).toBe(registrant.id);

      // The same endpoint, no cookie: what signing out looks like from here.
      const again = await subscribe(device);

      expect(again.status).toBe(204);
      expect(await pushSubscriptionOwner(device.endpoint)).toBeNull();

      // And off again: a device left subscribed here would be in the audience
      // of every event change below, because a subscription without an
      // account is (E43).
      await unsubscribe(device);
    });

    it('keeps a device out of the table once it unsubscribes', async () => {
      const device = await sink.device('temporary');
      await subscribe(device);

      await unsubscribe(device);

      expect(await pushSubscriptionOwner(device.endpoint)).toBeUndefined();
    });
  });

  describe('a changed event', () => {
    it('reaches the registrants and the devices without an account', async () => {
      await patchEvent(event.id, {
        startsAt: '2099-06-19T09:00:00.000Z',
        endsAt: '2099-06-19T16:00:00.000Z',
      });

      expect(await sink.waitFor(2)).toBe(true);
      await sink.quiet();
      // Bo is signed in and registered for nothing: notifications are not a
      // newsletter.
      expect(sink.notified()).toEqual(['anonymous', 'registrant']);
    });

    it('reaches them again when the place changes', async () => {
      await patchEvent(event.id, { venueName: 'Alte Feuerwache' });

      expect(await sink.waitFor(2)).toBe(true);
    });

    it('says nothing about a new description', async () => {
      await patchEvent(event.id, {
        description: 'Now with a programme, and nothing anybody has to know.',
      });

      await sink.quiet();
      expect(sink.notified()).toEqual([]);
    });

    it('says nothing about a draft, published or edited', async () => {
      await patchEvent(draft.id, {
        startsAt: '2099-07-01T09:00:00.000Z',
        endsAt: '2099-07-01T16:00:00.000Z',
      });
      await patchEvent(draft.id, { status: 'published' });

      await sink.quiet();
      // A draft is nobody's plan, and publishing one is an announcement (F8).
      expect(sink.notified()).toEqual([]);
    });

    it('says nothing about an event that is already over', async () => {
      await patchEvent(past.id, { status: 'archived' });

      await sink.quiet();
      // Archiving last year's conference is housekeeping, and "this is not
      // taking place" would be a lie about something that did.
      expect(sink.notified()).toEqual([]);
    });

    it('says that a future event is off when it is archived', async () => {
      await patchEvent(event.id, { status: 'archived' });

      expect(await sink.waitFor(2)).toBe(true);
      await sink.quiet();
      expect(sink.notified()).toEqual(['anonymous', 'registrant']);
    });
  });

  /**
   * E44, with a real socket in a real room.
   *
   * The rule is "push only when nobody is watching", and *watching* is the
   * room of one conversation rather than the connection: the socket belongs
   * to the session and stays open while somebody is signed in (F166), the
   * room is entered by the conversation view. A test that only had a
   * connection would pass with the rule reversed.
   */
  describe('a new message (E44)', () => {
    const listen = async (session: string): Promise<Socket> => {
      const socket = io(`${BASE_URL}${CHAT_NAMESPACE}`, {
        path: REALTIME_PATH,
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000,
        extraHeaders: { cookie: `${USER_SESSION_COOKIE}=${session}` },
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', (error: Error) => reject(error));
      });
      return socket;
    };

    const join = (socket: Socket, conversationId: string) =>
      new Promise<{ joined: boolean }>((resolve) => {
        socket.emit('chat:join', conversationId, (ack: { joined: boolean }) =>
          resolve(ack ?? { joined: false }),
        );
      });

    const say = (session: string, id: string, body: string) =>
      api(`/api/participant/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${USER_SESSION_COOKIE}=${session}`,
        },
        body: JSON.stringify({ body }),
      });

    let conversation = '';

    beforeAll(async () => {
      const { body } = await api<Conversation>(
        '/api/participant/conversations',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${USER_SESSION_COOKIE}=${registrant.session}`,
          },
          body: JSON.stringify({ profileId: stranger.id }),
        },
      );
      conversation = body.id;
      conversations.push(conversation);
    });

    it('notifies the member who is not there, and not the one who wrote it', async () => {
      await say(registrant.session, conversation, 'Are you coming by train?');

      expect(await sink.waitFor(1)).toBe(true);
      await sink.quiet();
      // Bo's device only. Amina wrote it, and her own device would be a
      // notification about herself.
      expect(sink.notified()).toEqual(['stranger']);
    });

    it('notifies nobody who has the conversation open', async () => {
      const socket = await listen(stranger.session);
      expect(await join(socket, conversation)).toEqual({ joined: true });

      await say(registrant.session, conversation, 'The bus leaves at eight.');
      await sink.quiet();

      // The socket delivered it. A notification about something somebody is
      // reading in that second is the kind people switch off.
      expect(sink.notified()).toEqual([]);
      socket.disconnect();
    });

    it('notifies a member who is connected but reading something else', async () => {
      const socket = await listen(stranger.session);
      // Connected, so in their own member room — which is where the
      // conversation list is refreshed from (F166) — but not in this
      // conversation's room.
      await say(registrant.session, conversation, 'Bringing the banner?');

      expect(await sink.waitFor(1)).toBe(true);
      expect(sink.notified()).toEqual(['stranger']);
      socket.disconnect();
    });
  });

  describe('with the push module switched off (E21)', () => {
    afterEach(() => setModule('push', true));

    it('sends nothing, although the subscriptions are still there (F63)', async () => {
      await setModule('push', false);

      await patchEvent(event.id, { venueName: 'Alte Feuerwache' });
      await sink.quiet();

      expect(sink.notified()).toEqual([]);
      // Switching a module off never deletes data.
      expect(await pushSubscriptionOwner(anonymousDevice.endpoint)).toBeNull();
    });

    it('answers 404 rather than storing a subscription nobody would read', async () => {
      await setModule('push', false);
      const device = await sink.device('while-off');

      const response = await subscribe(device);

      expect(response.status).toBe(404);
      expect(await pushSubscriptionOwner(device.endpoint)).toBeUndefined();
    });
  });
});
