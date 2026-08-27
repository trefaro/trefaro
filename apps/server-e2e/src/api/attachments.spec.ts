import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { api, postJson } from '../support/api-client';
import { waitForMailpit } from '../support/mailpit';

/**
 * Contract of the file upload field type (E9, F12, FR 3.5) — AP 7.
 *
 * This is the suite that proves the acceptance criterion of the work package,
 * and it is deliberately the only place where all three halves of it are checked
 * together, because each is enforced somewhere else:
 *
 * 1. **A stored file is not reachable without a session.** The administrative
 *    guard decides that, by virtue of the path (E16) — there is no other route
 *    to the bytes at all.
 * 2. **A file that is too large or of the wrong type is refused.** The field
 *    definition decides that, and the file's own first bytes decide whether it
 *    is the type it claims to be.
 * 3. **The upload volume holds no orphan once the registration is gone.** No
 *    constraint can decide that: a foreign key cascade removes rows and leaves
 *    files. So this suite counts the files in the volume before and after —
 *    the only assertion in the repository that looks at the filesystem, and the
 *    reason it can is that the contract suite runs on the same machine as the
 *    server it talks to.
 */
const SESSION_COOKIE = 'trefaro_admin_session';

const credentials = {
  email: process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '',
  password: process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '',
};

/** The same directory the server writes to; see `UPLOAD_DIR` in `.env`. */
const UPLOAD_DIR = resolve(
  __dirname,
  '../../../..',
  process.env['UPLOAD_DIR'] ?? './tmp/uploads',
);

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
  key: string;
  type: string;
  accept: string[];
  maxSizeBytes: number | null;
  required: boolean;
}

interface Attachment {
  id: string;
  fieldKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface Detail {
  id: string;
  attachments: Attachment[];
}

/** Unique per run, so a leftover row cannot make the next run fail elsewhere. */
const stamp = Date.now();
const address = (name: string): string => `${name}-${stamp}@files.example.org`;

const FUTURE_EVENT = {
  name: 'Visa Documents Event',
  description: 'The event whose form asks for a document.',
  eventType: 'onsite',
  startsAt: '2099-07-14T08:00:00.000Z',
  endsAt: '2099-07-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

const APPLICANT = { firstName: 'Amina', lastName: 'Okonkwo' } as const;

/** A real PDF header, so the signature check passes. */
const pdf = (bytes = 32): Buffer =>
  Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), Buffer.alloc(bytes)]);

/** A real PNG header — used where a field accepts something else. */
const png = (): Buffer =>
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function cookieFrom(headers: Headers): string {
  for (const header of headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === SESSION_COOKIE)
      return `${SESSION_COOKIE}=${rest.join('=')}`;
  }
  return '';
}

/** Every file in the upload volume, recursively — an empty list if it is bare. */
async function storedFiles(directory = UPLOAD_DIR): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }

  const found: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) found.push(...(await storedFiles(path)));
    else found.push(path);
  }
  return found;
}

describe('registration attachments API', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
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

  const define = (payload: Record<string, unknown>, on: string) =>
    api<Field>(
      `/api/admin/events/${on}/registration-fields`,
      asAdminJson('POST', payload),
    );

  const defined = async (
    payload: Record<string, unknown>,
    on = event.id,
  ): Promise<Field> => {
    const response = await define(payload, on);
    expect(response.status).toBe(201);
    return response.body;
  };

  const clearForm = async (on = event.id): Promise<void> => {
    const fields = await api<Field[]>(
      `/api/admin/events/${on}/registration-fields`,
      asAdmin(),
    );
    for (const field of fields.body) {
      await api(
        `/api/admin/registration-fields/${field.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
  };

  const createEvent = async (
    payload: Record<string, unknown>,
  ): Promise<Event> =>
    (
      await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson('POST', payload),
      )
    ).body;

  /**
   * Submits the form as multipart, the way a browser with a file field does.
   *
   * The JSON body in the `payload` part, each file in a part named after its
   * field key — and no content type of ours, so `fetch` sets the boundary.
   */
  const submit = (
    email: string,
    files: readonly { key: string; file: File }[],
    extra: Record<string, unknown> = {},
    on: Event = event,
  ) => {
    const form = new FormData();
    form.append('payload', JSON.stringify({ ...APPLICANT, email, ...extra }));
    for (const { key, file } of files) form.append(key, file);
    return api<{ email: string } | { message: string }>(
      `/api/user/series/${series.slug}/events/${on.slug}/registrations`,
      { method: 'POST', body: form },
    );
  };

  /** A file part, as a browser would send it — name and type included. */
  const asFile = (
    bytes: Buffer,
    name = 'passport.pdf',
    type = 'application/pdf',
  ): File => new File([new Uint8Array(bytes)], name, { type });

  /** The registration id of an address, through the participant overview. */
  const idOf = async (email: string, on: Event = event): Promise<string> => {
    const found = await api<{ rows: { id: string }[] }>(
      `/api/admin/events/${on.id}/registrations?search=${encodeURIComponent(email)}`,
      asAdmin(),
    );
    const [row] = found.body.rows;
    if (!row) throw new Error(`No registration for ${email} in the overview.`);
    return row.id;
  };

  const detailOf = async (id: string): Promise<Detail> =>
    (await api<Detail>(`/api/admin/registrations/${id}`, asAdmin())).body;

  beforeAll(async () => {
    if (!credentials.email || !credentials.password) {
      throw new Error(
        'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set for the API contract tests.',
      );
    }
    await waitForMailpit();

    const login = await postJson('/api/admin/auth/login', credentials);
    cookie = cookieFrom(login.headers);

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Visa Documents Series ${stamp}`,
          description: 'Holds the event whose form asks for a document.',
          status: 'published',
        }),
      )
    ).body;

    event = await createEvent(FUTURE_EVENT);
  });

  afterEach(async () => {
    // Each test builds the form it needs; a leftover required file field would
    // make the next test fail for a reason that is not its own.
    await clearForm();
  });

  afterAll(async () => {
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

  describe('defining a file field', () => {
    it('is refused without an accepted type', async () => {
      const response = await define(
        { label: 'Passport', type: 'file' },
        event.id,
      );

      // A field that accepts everything accepts an executable.
      expect(response.status).toBe(400);
    });

    it('is refused for a type this instance does not store', async () => {
      const response = await define(
        { label: 'Passport', type: 'file', accept: ['application/zip'] },
        event.id,
      );

      // An archive hides its content from every check made here.
      expect(response.status).toBe(400);
    });

    it('gets a size limit without the organizer picking one', async () => {
      const field = await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
      });

      expect(field.maxSizeBytes).toBe(5 * 1024 * 1024);
    });

    it('tells the public form what it accepts and how large it may be', async () => {
      await defined({
        label: 'Passport scan',
        type: 'file',
        accept: ['application/pdf', 'image/png'],
        maxSizeBytes: 1024 * 1024,
        required: true,
        helpText: 'The page with your photograph.',
      });

      const form = await api<Field[]>(
        `/api/user/series/${series.slug}/events/${event.slug}/registration-fields`,
      );

      expect(form.status).toBe(200);
      expect(form.body[0]).toEqual({
        key: 'passport-scan',
        label: 'Passport scan',
        type: 'file',
        helpText: 'The page with your photograph.',
        options: [],
        accept: ['application/pdf', 'image/png'],
        maxSizeBytes: 1024 * 1024,
        required: true,
      });
    });
  });

  describe('submitting a file', () => {
    it('stores it, and shows it in the participant detail', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
        required: true,
      });
      const email = address('with-file');
      const before = await storedFiles();

      const response = await submit(email, [
        { key: 'passport', file: asFile(pdf(100), 'Reisepass Amina.pdf') },
      ]);

      expect(response.status).toBe(202);
      const id = await idOf(email);
      registrations.push(id);
      const detail = await detailOf(id);
      expect(detail.attachments).toEqual([
        {
          id: expect.any(String),
          fieldKey: 'passport',
          fileName: 'Reisepass Amina.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 109,
          uploadedAt: expect.any(String),
        },
      ]);
      // Exactly one file more in the volume, under a name this application
      // generated rather than one the participant chose.
      const after = await storedFiles();
      expect(after).toHaveLength(before.length + 1);
      expect(after.join()).not.toContain('Reisepass');
    });

    it('refuses a missing file for a required field, and writes nothing', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
        required: true,
      });
      const email = address('no-file');
      const before = await storedFiles();

      const response = await submit(email, []);

      expect(response.status).toBe(400);
      expect(await storedFiles()).toHaveLength(before.length);
    });

    it('refuses a file of a type the field does not accept', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
      });

      const response = await submit(address('wrong-type'), [
        { key: 'passport', file: asFile(png(), 'passport.png', 'image/png') },
      ]);

      expect(response.status).toBe(400);
    });

    it('refuses a file larger than the field takes', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
        maxSizeBytes: 64 * 1024,
      });

      const response = await submit(address('too-large'), [
        { key: 'passport', file: asFile(pdf(100 * 1024)) },
      ]);

      expect(response.status).toBe(400);
    });

    it('refuses a file whose bytes are not the type it claims', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
      });

      // The case the allowlist alone cannot catch: the content type of a
      // multipart part is set by whoever sends the request.
      const response = await submit(address('renamed'), [
        {
          key: 'passport',
          file: asFile(png(), 'passport.pdf', 'application/pdf'),
        },
      ]);

      expect(response.status).toBe(400);
    });

    it('refuses a file part no field asked for', async () => {
      await defined({ label: 'Comment', type: 'text' });

      const response = await submit(address('unknown-part'), [
        { key: 'proof-of-payment', file: asFile(pdf()) },
      ]);

      // The same rule as for an unknown answer key (F35): refused, not dropped.
      expect(response.status).toBe(400);
    });

    it('refuses a value where a file is asked for', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
      });

      const response = await submit(address('value-not-file'), [], {
        customFields: { passport: 'I will bring it along' },
      });

      expect(response.status).toBe(400);
    });

    it('replaces the file of the same field, and the old bytes with it', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
      });
      const email = address('replaced');

      const first = await submit(email, [
        { key: 'passport', file: asFile(pdf(10), 'first.pdf') },
      ]);
      expect(first.status).toBe(202);
      const id = await idOf(email);
      registrations.push(id);
      const before = await storedFiles();

      const second = await submit(email, [
        { key: 'passport', file: asFile(pdf(20), 'second.pdf') },
      ]);

      expect(second.status).toBe(202);
      const detail = await detailOf(id);
      // One file per field: a corrected upload is a correction, not a version.
      expect(detail.attachments).toHaveLength(1);
      expect(detail.attachments[0].fileName).toBe('second.pdf');
      expect(await storedFiles()).toHaveLength(before.length);
    });
  });

  describe('downloading a file', () => {
    let attachment: Attachment;

    beforeEach(async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
      });
      const email = address(`download-${Math.random().toString(36).slice(2)}`);
      const response = await submit(email, [
        { key: 'passport', file: asFile(pdf(64), 'Grüße.pdf') },
      ]);
      expect(response.status).toBe(202);
      const id = await idOf(email);
      registrations.push(id);
      [attachment] = (await detailOf(id)).attachments;
    });

    it('is refused without an administrative session', async () => {
      const response = await api(`/api/admin/attachments/${attachment.id}`);

      // The first half of the acceptance criterion. There is no other route to
      // the bytes: the volume is not served statically at all (E9).
      expect(response.status).toBe(401);
    });

    it('answers with the bytes, as an attachment under its own name', async () => {
      const response = await fetch(
        `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}/api/admin/attachments/${attachment.id}`,
        { headers: { cookie } },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/pdf');
      const disposition = response.headers.get('content-disposition') ?? '';
      // Never `inline`: on the same origin as the organizer client, a rendered
      // file would be running inside it.
      expect(disposition).toContain('attachment;');
      expect(disposition).toContain("filename*=UTF-8''Gr%C3%BC%C3%9Fe.pdf");
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(bytes).toHaveLength(73);
    });

    it('answers 404 for an attachment that does not exist', async () => {
      const response = await api(
        '/api/admin/attachments/00000000-0000-4000-8000-000000000000',
        asAdmin(),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('deleting', () => {
    it('takes the files of a registration with it, leaving no orphan', async () => {
      await defined({
        label: 'Passport',
        type: 'file',
        accept: ['application/pdf'],
      });
      const email = address('deleted');
      const before = await storedFiles();
      expect(
        (await submit(email, [{ key: 'passport', file: asFile(pdf(30)) }]))
          .status,
      ).toBe(202);
      const id = await idOf(email);
      const [attachment] = (await detailOf(id)).attachments;
      expect(await storedFiles()).toHaveLength(before.length + 1);

      const deleted = await api(
        `/api/admin/registrations/${id}`,
        asAdmin({ method: 'DELETE' }),
      );

      expect(deleted.status).toBe(204);
      // The third half of the acceptance criterion: the row is gone *and* the
      // volume is back to what it held before.
      expect(
        (await api(`/api/admin/attachments/${attachment.id}`, asAdmin()))
          .status,
      ).toBe(404);
      expect(await storedFiles()).toEqual(before);
    });

    it('takes the files of a whole event with it', async () => {
      // The trap this test exists for: deleting an event cascades through its
      // registrations in the database, and a cascade removes no files.
      const throwaway = await createEvent({
        ...FUTURE_EVENT,
        name: `Throwaway Event ${stamp}`,
      });
      await defined(
        { label: 'Passport', type: 'file', accept: ['application/pdf'] },
        throwaway.id,
      );
      const before = await storedFiles();
      expect(
        (
          await submit(
            address('event-deleted'),
            [{ key: 'passport', file: asFile(pdf(40)) }],
            {},
            throwaway,
          )
        ).status,
      ).toBe(202);
      expect(await storedFiles()).toHaveLength(before.length + 1);

      const deleted = await api(
        `/api/admin/events/${throwaway.id}`,
        asAdmin({ method: 'DELETE' }),
      );

      expect(deleted.status).toBe(204);
      expect(await storedFiles()).toEqual(before);
    });
  });
});
