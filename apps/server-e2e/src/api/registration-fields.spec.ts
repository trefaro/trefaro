import { api, postJson } from '../support/api-client';
import { waitForMailpit } from '../support/mailpit';

/**
 * Contract of the field kit (F12, FR 3.5) — AP 6.
 *
 * This is the suite that proves the acceptance criterion of the work package: a
 * newly defined required field makes a registration without that answer fail
 * with 400, and an unknown field key does not disappear silently either.
 *
 * The two halves of the criterion are enforced in different places, which is why
 * both are asserted here rather than in a unit test: the request's own unknown
 * properties are refused by the global validation pipe (`forbidNonWhitelisted`),
 * and an unknown *field key* is refused by the service against the definitions
 * of that event — the only thing that knows them.
 *
 * The registrations go in through the real public endpoint, mail and all: the
 * point of this suite is the seam between the form an organizer built and the
 * form a participant fills in.
 */
const SESSION_COOKIE = 'trefaro_admin_session';

const credentials = {
  email: process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '',
  password: process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '',
};

interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
}

interface Field {
  id: string;
  eventId: string;
  key: string;
  label: string;
  type: string;
  helpText: string | null;
  options: string[];
  required: boolean;
  sort: number;
}

interface Row {
  id: string;
  email: string;
  customFields: Record<string, string | boolean>;
}

/** Unique per run, so a leftover row cannot make the next run fail elsewhere. */
const stamp = Date.now();
const address = (name: string): string => `${name}-${stamp}@fields.example.org`;

const FUTURE_EVENT = {
  name: 'Field Kit Event',
  description: 'The event whose registration form this suite builds.',
  eventType: 'onsite',
  startsAt: '2099-06-14T08:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

const APPLICANT = {
  firstName: 'Amina',
  lastName: 'Okonkwo',
} as const;

function cookieFrom(headers: Headers): string {
  for (const header of headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === SESSION_COOKIE)
      return `${SESSION_COOKIE}=${rest.join('=')}`;
  }
  return '';
}

describe('registration fields API', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  let draftEvent: Event;
  /** Registrations created here, removed again in the teardown. */
  const registrations: string[] = [];

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const fieldsOf = (eventId: string) =>
    api<Field[]>(`/api/admin/events/${eventId}/registration-fields`, asAdmin());

  const define = (payload: Record<string, unknown>, on = event.id) =>
    api<Field>(
      `/api/admin/events/${on}/registration-fields`,
      asAdminJson('POST', payload),
    );

  /** Defines a field and fails the test if it could not be defined. */
  const defined = async (payload: Record<string, unknown>): Promise<Field> => {
    const response = await define(payload);
    expect(response.status).toBe(201);
    return response.body;
  };

  const removeField = (id: string) =>
    api(`/api/admin/registration-fields/${id}`, asAdmin({ method: 'DELETE' }));

  /** Removes every field of the event, so each test starts from a bare form. */
  const clearForm = async (): Promise<void> => {
    for (const field of (await fieldsOf(event.id)).body) {
      await removeField(field.id);
    }
  };

  const register = (email: string, customFields?: unknown) =>
    postJson<{ email: string } | { message: string }>(
      `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
      {
        ...APPLICANT,
        email,
        ...(customFields === undefined ? {} : { customFields }),
      },
    );

  /** The registration's own row, looked up through the participant overview. */
  const rowOf = async (email: string): Promise<Row> => {
    const found = await api<{ rows: Row[] }>(
      `/api/admin/events/${event.id}/registrations?search=${encodeURIComponent(email)}`,
      asAdmin(),
    );
    const [row] = found.body.rows;
    if (!row) throw new Error(`No registration for ${email} in the overview.`);
    return row;
  };

  /** Registers, remembers the row for the teardown, and returns it. */
  const registered = async (
    name: string,
    customFields: unknown,
  ): Promise<Row> => {
    const email = address(name);
    const response = await register(email, customFields);
    expect(response.status).toBe(202);
    const row = await rowOf(email);
    registrations.push(row.id);
    return row;
  };

  beforeAll(async () => {
    if (!credentials.email || !credentials.password) {
      throw new Error(
        'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set for the API contract tests.',
      );
    }
    // Every accepted registration sends a mail, and a failed delivery would be
    // reported as 503 rather than as the 400 this suite is about.
    await waitForMailpit();

    const login = await postJson('/api/admin/auth/login', credentials);
    cookie = cookieFrom(login.headers);

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Field Kit Series ${stamp}`,
          description: 'Holds the event whose form this suite builds.',
          status: 'published',
        }),
      )
    ).body;

    const createEvent = async (
      payload: Record<string, unknown>,
    ): Promise<Event> =>
      (
        await api<Event>(
          `/api/admin/series/${series.id}/events`,
          asAdminJson('POST', payload),
        )
      ).body;

    event = await createEvent(FUTURE_EVENT);
    draftEvent = await createEvent({
      ...FUTURE_EVENT,
      name: 'Field Kit Draft Event',
      status: 'draft',
    });
  });

  afterEach(async () => {
    // Each test builds the form it needs; a leftover required field would make
    // the next test fail for a reason that is not its own.
    await clearForm();
  });

  afterAll(async () => {
    // Registrations first: a confirmed one blocks deleting the series (E14).
    for (const id of registrations) {
      await api(
        `/api/admin/registrations/${id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
    if (series?.id) {
      await api(
        `/api/admin/series/${series.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
  });

  describe('building the form', () => {
    it('derives the key an answer is stored under from the label', async () => {
      const field = await defined({
        label: 'Dietary requirements',
        type: 'text',
      });

      expect(field.key).toBe('dietary-requirements');
      expect(field.sort).toBe(0);
      expect(field.required).toBe(false);
    });

    it('appends a new question to the end of the form', async () => {
      await defined({ label: 'First question', type: 'text' });
      const second = await defined({ label: 'Second question', type: 'text' });

      // Not in the middle of a form people are already filling in.
      expect(second.sort).toBe(1);
      expect((await fieldsOf(event.id)).body.map((f) => f.label)).toEqual([
        'First question',
        'Second question',
      ]);
    });

    it('reorders the whole form at once', async () => {
      const first = await defined({ label: 'First', type: 'text' });
      const second = await defined({ label: 'Second', type: 'text' });
      const third = await defined({ label: 'Third', type: 'text' });

      const reordered = await api<Field[]>(
        `/api/admin/events/${event.id}/registration-fields/order`,
        asAdminJson('PUT', { ids: [third.id, first.id, second.id] }),
      );

      expect(reordered.status).toBe(200);
      expect(reordered.body.map((field) => field.label)).toEqual([
        'Third',
        'First',
        'Second',
      ]);
      expect(reordered.body.map((field) => field.sort)).toEqual([0, 1, 2]);
    });

    it('refuses an order that leaves a field out', async () => {
      const first = await defined({ label: 'First', type: 'text' });
      await defined({ label: 'Second', type: 'text' });

      const response = await api(
        `/api/admin/events/${event.id}/registration-fields/order`,
        asAdminJson('PUT', { ids: [first.id] }),
      );

      // Half a reorder leaves the rest at positions that mean nothing.
      expect(response.status).toBe(400);
    });

    it('keeps the key when the question is reworded', async () => {
      const field = await defined({
        label: 'Where do you come form?',
        type: 'text',
      });

      const fixed = await api<Field>(
        `/api/admin/registration-fields/${field.id}`,
        asAdminJson('PATCH', { label: 'Where do you come from?' }),
      );

      expect(fixed.status).toBe(200);
      expect(fixed.body.label).toBe('Where do you come from?');
      // The whole reason label and key are two things: rephrasing a question
      // must not orphan the answers already given.
      expect(fixed.body.key).toBe(field.key);
    });

    it('refuses a selection field without choices', async () => {
      const response = await define({ label: 'Meal', type: 'select' });

      // An empty dropdown is a field nobody can fill in.
      expect(response.status).toBe(400);
    });

    it('refuses choices on a field that is not a selection', async () => {
      const response = await define({
        label: 'Comment',
        type: 'text',
        options: ['a', 'b'],
      });

      expect(response.status).toBe(400);
    });

    it('refuses a type that does not exist', async () => {
      // Four types exist; `file` joined them in AP 7 and is covered by its own
      // suite, together with the storage it needs.
      const response = await define({ label: 'Signature', type: 'signature' });

      expect(response.status).toBe(400);
    });

    it('refuses a key the registration itself owns', async () => {
      const response = await define({ label: 'Email', type: 'text' });

      expect(response.status).toBe(409);
    });

    it('reports an unknown event instead of an empty form', async () => {
      const response = await api(
        '/api/admin/events/00000000-0000-0000-0000-000000000000/registration-fields',
        asAdmin(),
      );

      expect(response.status).toBe(404);
    });

    it('lets nobody read or change a form without a session', async () => {
      const field = await defined({ label: 'Dietary', type: 'text' });

      const attempts = await Promise.all([
        api(`/api/admin/events/${event.id}/registration-fields`),
        api(`/api/admin/events/${event.id}/registration-fields`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label: 'Sneaky', type: 'text' }),
        }),
        api(`/api/admin/registration-fields/${field.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label: 'Sneaky' }),
        }),
        api(`/api/admin/registration-fields/${field.id}`, {
          method: 'DELETE',
        }),
      ]);

      expect(attempts.map((attempt) => attempt.status)).toEqual([
        401, 401, 401, 401,
      ]);
    });
  });

  describe('the public form', () => {
    const publicFields = (slug = event.slug) =>
      api<Omit<Field, 'id' | 'eventId' | 'sort'>[]>(
        `/api/user/series/${series.slug}/events/${slug}/registration-fields`,
      );

    it('answers without a session, with the questions in form order', async () => {
      await defined({
        label: 'Dietary requirements',
        type: 'text',
        helpText: 'So the caterer knows.',
      });
      await defined({
        label: 'Meal',
        type: 'select',
        options: ['Vegan', 'Vegetarian'],
        required: true,
      });

      const response = await publicFields();

      expect(response.status).toBe(200);
      // `accept` and `maxSizeBytes` belong to the file field type (AP 7) and are
      // empty and null for every other type — the form still renders from this
      // one payload alone.
      expect(response.body).toEqual([
        {
          key: 'dietary-requirements',
          label: 'Dietary requirements',
          type: 'text',
          helpText: 'So the caterer knows.',
          options: [],
          accept: [],
          maxSizeBytes: null,
          required: false,
        },
        {
          key: 'meal',
          label: 'Meal',
          type: 'select',
          helpText: null,
          options: ['Vegan', 'Vegetarian'],
          accept: [],
          maxSizeBytes: null,
          required: true,
        },
      ]);
    });

    it('says nothing about the form of an event that is not published', async () => {
      const response = await publicFields(draftEvent.slug);

      expect(response.status).toBe(404);
    });
  });

  describe('answering the form', () => {
    it('refuses a registration without an answer to a required field', async () => {
      await defined({ label: 'Passport name', type: 'text', required: true });

      const response = await register(address('missing'), {});

      // The acceptance criterion of AP 6, first half.
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).toContain('Passport name');
    });

    it('refuses a registration that answers nothing at all', async () => {
      await defined({ label: 'Passport name', type: 'text', required: true });

      // Not sending `customFields` at all is the same omission as sending it
      // empty — a form that accepted this would make "required" decorative.
      const response = await register(address('absent'));

      expect(response.status).toBe(400);
    });

    it('refuses an unknown field key instead of dropping it', async () => {
      await defined({ label: 'Dietary requirements', type: 'text' });

      const response = await register(address('unknown-key'), {
        'dietary-requirement': 'vegan',
      });

      // The acceptance criterion of AP 6, second half: a typo in a key that
      // disappeared silently would cost an answer nobody notices is missing.
      expect(response.status).toBe(400);
    });

    it('refuses an unknown property of the request itself', async () => {
      // The same rule one level up, enforced by the global validation pipe.
      const response = await postJson(
        `/api/user/series/${series.slug}/events/${event.slug}/registrations`,
        { ...APPLICANT, email: address('unknown-prop'), favourite: 'blue' },
      );

      expect(response.status).toBe(400);
    });

    it('refuses a choice the selection does not offer', async () => {
      await defined({
        label: 'Meal',
        type: 'select',
        options: ['Vegan', 'Vegetarian'],
      });

      const response = await register(address('wrong-choice'), {
        meal: 'Steak',
      });

      expect(response.status).toBe(400);
    });

    it('refuses an answer of the wrong kind', async () => {
      await defined({ label: 'Comment', type: 'text' });

      const response = await register(address('wrong-type'), { comment: true });

      expect(response.status).toBe(400);
    });

    it('requires a required checkbox to be ticked, not merely answered', async () => {
      await defined({
        label: 'Code of conduct',
        type: 'checkbox',
        required: true,
      });

      const refused = await register(address('unticked'), {
        'code-of-conduct': false,
      });

      // A consent box that accepts "no" is not a consent box.
      expect(refused.status).toBe(400);
    });

    it('stores the answers and shows them in the participant overview', async () => {
      await defined({ label: 'Passport name', type: 'text', required: true });
      await defined({
        label: 'Meal',
        type: 'select',
        options: ['Vegan', 'Vegetarian'],
      });
      await defined({ label: 'Needs a visa letter', type: 'checkbox' });
      await defined({ label: 'Comment', type: 'text' });

      const row = await registered('answered', {
        'passport-name': '  Amina Okonkwo  ',
        meal: 'Vegan',
        'needs-a-visa-letter': true,
        comment: '   ',
      });

      expect(row.customFields).toEqual({
        // Trimmed, and the field left blank stored as absent rather than as an
        // empty string — "no answer" and "answered with nothing" are the same.
        'passport-name': 'Amina Okonkwo',
        meal: 'Vegan',
        'needs-a-visa-letter': true,
      });

      // And through the detail endpoint, which is what the panel reads.
      const detail = await api<Row>(
        `/api/admin/registrations/${row.id}`,
        asAdmin(),
      );
      expect(detail.body.customFields).toEqual(row.customFields);
    });

    it('keeps a "no" to an optional checkbox', async () => {
      await defined({ label: 'Needs a visa letter', type: 'checkbox' });

      const row = await registered('says-no', {
        'needs-a-visa-letter': false,
      });

      // "No" is an answer; only an absent key means the question was skipped.
      expect(row.customFields).toEqual({ 'needs-a-visa-letter': false });
    });

    it('keeps the answers after their question was removed (F34)', async () => {
      const field = await defined({ label: 'Shirt size', type: 'text' });

      const row = await registered('leftover', { 'shirt-size': 'L' });
      const removed = await removeField(field.id);

      expect(removed.status).toBe(204);
      // The organizer removed the question, not the answer. The overview shows
      // it under its bare key rather than dropping it.
      expect((await rowOf(row.email)).customFields).toEqual({
        'shirt-size': 'L',
      });
    });
  });
});
