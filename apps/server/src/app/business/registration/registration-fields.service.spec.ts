import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type {
  CustomFieldValues,
  OrganizerEvent,
  PublicEvent,
} from '@trefaro/shared-models';
import {
  DEFAULT_UPLOAD_MAX_BYTES,
  MAX_CUSTOM_TEXT_LENGTH,
  MAX_FILE_FIELDS,
  MAX_SUBMISSION_BYTES,
  MAX_UPLOAD_BYTES,
} from '@trefaro/shared-models';
import type { UploadedFile } from '../attachments';
import type { EventsService } from '../events';
import {
  RegistrationFieldKeyTakenError,
  type NewRegistrationField,
  type RegistrationFieldChanges,
  type RegistrationFieldRecord,
  type RegistrationFieldRepository,
} from './ports/registration-field.repository';
import { RegistrationFieldsService } from './registration-fields.service';

const EVENT = {
  id: 'event-1',
  seriesId: 'series-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  description: 'The opening weekend.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  status: 'published',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
} as const satisfies OrganizerEvent;

/** In-memory field kit, close enough to the real table to be worth asserting on. */
class FakeRegistrationFieldRepository implements RegistrationFieldRepository {
  readonly rows: RegistrationFieldRecord[] = [];
  private nextId = 1;

  async findByEvent(
    eventId: string,
  ): Promise<readonly RegistrationFieldRecord[]> {
    return this.rows
      .filter((row) => row.eventId === eventId)
      .sort(
        (left, right) =>
          left.sort - right.sort || (left.id < right.id ? -1 : 1),
      );
  }

  async findById(id: string): Promise<RegistrationFieldRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(field: NewRegistrationField): Promise<RegistrationFieldRecord> {
    // The unique index, as the database would enforce it (F12).
    if (
      this.rows.some(
        (row) => row.eventId === field.eventId && row.key === field.key,
      )
    ) {
      throw new RegistrationFieldKeyTakenError(field.eventId, field.key);
    }
    const created: RegistrationFieldRecord = {
      id: `field-${this.nextId++}`,
      ...field,
    };
    this.rows.push(created);
    return created;
  }

  async update(
    id: string,
    changes: RegistrationFieldChanges,
  ): Promise<RegistrationFieldRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = { ...this.rows[index], ...changes };
    return this.rows[index];
  }

  async delete(id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }

  async reorder(
    eventId: string,
    orderedIds: readonly string[],
  ): Promise<readonly RegistrationFieldRecord[]> {
    for (const [sort, id] of orderedIds.entries()) {
      const index = this.rows.findIndex(
        (row) => row.id === id && row.eventId === eventId,
      );
      if (index >= 0) this.rows[index] = { ...this.rows[index], sort };
    }
    return this.findByEvent(eventId);
  }
}

class FakeEventsService {
  /** Set to make the public lookup behave like a draft or unknown event. */
  publiclyVisible = true;

  async getForOrganizer(id: string): Promise<OrganizerEvent> {
    if (id !== EVENT.id)
      throw new NotFoundException(`No event with id "${id}"`);
    return EVENT;
  }

  async getPublic(): Promise<PublicEvent> {
    if (!this.publiclyVisible) throw new NotFoundException('No such event');
    return EVENT;
  }
}

/** A file that really is what it says: the first bytes of a PDF. */
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');
/** Bytes of no known kind — what a renamed executable looks like. */
const NOT_A_PDF = Buffer.from('MZ\u0090\u0000\u0003', 'latin1');

const upload = (
  fieldKey: string,
  overrides: Partial<UploadedFile> = {},
): UploadedFile => ({
  fieldKey,
  fileName: 'passport.pdf',
  mimeType: 'application/pdf',
  bytes: PDF,
  ...overrides,
});

describe('RegistrationFieldsService', () => {
  let repository: FakeRegistrationFieldRepository;
  let events: FakeEventsService;
  let service: RegistrationFieldsService;

  beforeEach(() => {
    repository = new FakeRegistrationFieldRepository();
    events = new FakeEventsService();
    service = new RegistrationFieldsService(
      repository,
      events as unknown as EventsService,
    );
  });

  const add = (
    label: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; key: string; sort: number }> =>
    service.create(EVENT.id, { label, type: 'text', ...overrides });

  const addFile = (label: string, overrides: Record<string, unknown> = {}) =>
    service.create(EVENT.id, {
      label,
      type: 'file',
      accept: ['application/pdf'],
      ...overrides,
    });

  /** The values half of a checked submission — what most of these assert on. */
  const answers = async (
    given: CustomFieldValues | undefined,
    files: readonly UploadedFile[] = [],
  ): Promise<CustomFieldValues> =>
    (await service.validateSubmission(EVENT.id, given, files)).customFields;

  describe('create', () => {
    it('derives the key an answer is stored under from the label', async () => {
      const field = await add('Dietary requirements');

      expect(field.key).toBe('dietary-requirements');
    });

    it('transliterates a German label rather than stripping it', async () => {
      const field = await add('Grüße an die Bürgerräte');

      expect(field.key).toBe('gruesse-an-die-buergerraete');
    });

    it('numbers a key two labels shorten to the same way', async () => {
      await add('Where from?');
      const second = await add('Where from!');

      // A dead end would be worse: an organizer cannot see why the second
      // question is refused, and the key is not something they think about.
      expect(second.key).toBe('where-from-2');
    });

    it('appends to the end of the form', async () => {
      await add('First question');
      const second = await add('Second question');

      // Not in the middle of a form people are already filling in.
      expect(second.sort).toBe(1);
    });

    it('refuses a key the registration itself owns', async () => {
      // A second "email" would collide the moment anything flattens a
      // registration into one record — the export of phase 5, a mail template.
      await expect(add('Email')).rejects.toThrow(ConflictException);
    });

    it('refuses a given key that is not a key', async () => {
      // Taken literally rather than slugified: a key is given to match
      // something outside this application, so rewriting it defeats the point.
      await expect(add('Anything', { key: 'Not A Key' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a selection field without choices', async () => {
      // An empty dropdown is a field nobody can fill in.
      await expect(add('Meal', { type: 'select' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses choices for a field that is not a selection', async () => {
      await expect(
        add('Comment', { type: 'text', options: ['a', 'b'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('drops duplicate and blank choices instead of refusing them', async () => {
      const field = await service.create(EVENT.id, {
        label: 'Meal',
        type: 'select',
        options: ['Vegan', ' Vegan ', '', 'Vegetarian'],
      });

      // Two identical entries in a dropdown are a slip of the paste buffer.
      expect(field.options).toEqual(['Vegan', 'Vegetarian']);
    });

    it('refuses a file field that accepts nothing', async () => {
      // The same reason a selection needs a choice, one step more serious: a
      // field that accepts everything accepts an executable.
      await expect(
        service.create(EVENT.id, { label: 'Passport', type: 'file' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a file type this instance does not store', async () => {
      await expect(
        addFile('Passport', { accept: ['application/zip'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses accepted types on a field that is not a file field', async () => {
      await expect(
        add('Comment', { accept: ['application/pdf'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('gives a file field a size limit without being asked', async () => {
      const field = await addFile('Passport');

      // An organizer who has to pick a number before the field works is being
      // asked a question they have no way to answer.
      expect(field.maxSizeBytes).toBe(DEFAULT_UPLOAD_MAX_BYTES);
    });

    it('refuses a limit above what the server reads at all', async () => {
      await expect(
        addFile('Passport', { maxSizeBytes: MAX_UPLOAD_BYTES + 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a size limit on a field that is not a file field', async () => {
      await expect(add('Comment', { maxSizeBytes: 1024 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('bounds how many files one form asks for', async () => {
      for (let index = 0; index < MAX_FILE_FIELDS; index += 1) {
        await addFile(`Document ${index}`);
      }

      // Five times the ceiling is what one submission of a public endpoint may
      // cost; a sixth document is asking too much of a participant anyway.
      await expect(addFile('One more')).rejects.toThrow(ConflictException);
    });

    it('reports an unknown event rather than creating a field nobody sees', async () => {
      await expect(
        service.create('event-404', { label: 'Anything', type: 'text' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('keeps the key when the label is corrected', async () => {
      const field = await add('Where do you come form?');

      const fixed = await service.update(field.id, {
        label: 'Where do you come from?',
      });

      // The whole point of separating the two: rephrasing a question must not
      // orphan the answers already given.
      expect(fixed.label).toBe('Where do you come from?');
      expect(fixed.key).toBe(field.key);
    });

    it('refuses choices on a field that is not a selection', async () => {
      const field = await add('Comment');

      await expect(
        service.update(field.id, { options: ['a'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses emptying the choices of a selection field', async () => {
      const field = await service.create(EVENT.id, {
        label: 'Meal',
        type: 'select',
        options: ['Vegan'],
      });

      await expect(service.update(field.id, { options: [] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reorder', () => {
    it('renumbers the form densely', async () => {
      const first = await add('First');
      const second = await add('Second');
      const third = await add('Third');

      const order = await service.reorder(EVENT.id, [
        third.id,
        first.id,
        second.id,
      ]);

      expect(order.map((field) => field.label)).toEqual([
        'Third',
        'First',
        'Second',
      ]);
      expect(order.map((field) => field.sort)).toEqual([0, 1, 2]);
    });

    it('refuses a list that leaves a field out', async () => {
      const first = await add('First');
      await add('Second');

      // Half a reorder leaves the rest at positions that mean nothing.
      await expect(service.reorder(EVENT.id, [first.id])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a list that names a field twice', async () => {
      const first = await add('First');
      await add('Second');

      await expect(
        service.reorder(EVENT.id, [first.id, first.id]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listPublic', () => {
    it('says nothing about the form of an event that is not public', async () => {
      await add('Dietary requirements');
      events.publiclyVisible = false;

      await expect(service.listPublic('reihe', 'kickoff')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('leaves the ids out of what a registration form needs', async () => {
      await add('Dietary requirements');

      const [field] = await service.listPublic('reihe', 'kickoff');

      expect(field).toEqual({
        key: 'dietary-requirements',
        label: 'Dietary requirements',
        type: 'text',
        helpText: null,
        options: [],
        accept: [],
        maxSizeBytes: null,
        required: false,
      });
    });
  });

  describe('validateSubmission', () => {
    it('accepts a registration for an event without extra fields', async () => {
      await expect(answers(undefined)).resolves.toEqual({});
    });

    it('refuses an unknown key instead of dropping it', async () => {
      await add('Dietary requirements');

      // The rule the global validation pipe applies to the request's own
      // properties, one level down: a typo must not cost an answer silently.
      await expect(answers({ 'dietary-requirement': 'vegan' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a missing answer to a required field', async () => {
      await add('Passport name', { required: true });

      await expect(answers({})).rejects.toThrow(BadRequestException);
    });

    it('treats an empty string as no answer at all', async () => {
      await add('Passport name', { required: true });

      await expect(answers({ 'passport-name': '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('drops an unanswered optional field rather than storing an empty value', async () => {
      await add('Comment');

      await expect(answers({ comment: '' })).resolves.toEqual({});
    });

    it('trims what was typed', async () => {
      await add('Passport name');

      await expect(answers({ 'passport-name': '  Amina  ' })).resolves.toEqual({
        'passport-name': 'Amina',
      });
    });

    it('refuses an answer longer than a text field takes', async () => {
      await add('Comment');

      await expect(
        answers({
          comment: 'x'.repeat(MAX_CUSTOM_TEXT_LENGTH + 1),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a choice the selection does not offer', async () => {
      await service.create(EVENT.id, {
        label: 'Meal',
        type: 'select',
        options: ['Vegan', 'Vegetarian'],
      });

      await expect(answers({ meal: 'Steak' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('requires a required checkbox to be ticked, not merely answered', async () => {
      await add('Code of conduct', { type: 'checkbox', required: true });

      // A consent box that accepts "no" is not a consent box.
      await expect(answers({ 'code-of-conduct': false })).rejects.toThrow(
        BadRequestException,
      );
      await expect(answers({ 'code-of-conduct': true })).resolves.toEqual({
        'code-of-conduct': true,
      });
    });

    it('keeps a "no" to an optional checkbox', async () => {
      await add('Needs a visa letter', { type: 'checkbox' });

      // "No" is an answer; only an absent key means the question was skipped.
      await expect(answers({ 'needs-a-visa-letter': false })).resolves.toEqual({
        'needs-a-visa-letter': false,
      });
    });

    it('refuses a value of the wrong kind', async () => {
      await add('Comment');
      await add('Visa', { type: 'checkbox' });

      await expect(
        answers({
          comment: true,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(answers({ visa: 'yes' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts a file the field asked for', async () => {
      await addFile('Passport');

      const checked = await service.validateSubmission(EVENT.id, undefined, [
        upload('passport'),
      ]);

      // Nothing about the file goes into the values (F37): it is an attachment
      // row of its own, and a copy of it in the JSON could disagree with it.
      expect(checked.customFields).toEqual({});
      expect(checked.uploads).toEqual([
        {
          fieldKey: 'passport',
          fileName: 'passport.pdf',
          mimeType: 'application/pdf',
          bytes: PDF,
        },
      ]);
    });

    it('refuses a missing file for a required file field', async () => {
      await addFile('Passport', { required: true });

      // Required on every submission, including a repeated one: making the rule
      // depend on what was uploaded before would tell a stranger whether the
      // address is registered (E10).
      await expect(answers(undefined)).rejects.toThrow(BadRequestException);
    });

    it('drops an unanswered optional file field', async () => {
      await addFile('Passport');

      await expect(answers(undefined)).resolves.toEqual({});
    });

    it('refuses a type the field does not accept', async () => {
      await addFile('Passport', { accept: ['image/png'] });

      await expect(answers(undefined, [upload('passport')])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a file larger than the field takes', async () => {
      await addFile('Passport', { maxSizeBytes: 64 * 1024 });

      const large = Buffer.concat([PDF, Buffer.alloc(64 * 1024)]);
      await expect(
        answers(undefined, [upload('passport', { bytes: large })]),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a file whose bytes are not what it claims to be', async () => {
      await addFile('Passport');

      // The type of a multipart part is set by whoever sends the request, so an
      // allowlist alone accepts an executable called passport.pdf.
      await expect(
        answers(undefined, [upload('passport', { bytes: NOT_A_PDF })]),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses an empty file', async () => {
      await addFile('Passport');

      await expect(
        answers(undefined, [upload('passport', { bytes: Buffer.alloc(0) })]),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a file no field asked for', async () => {
      await addFile('Passport');

      await expect(
        answers(undefined, [upload('proof-of-payment')]),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a file sent for a field that is not a file field', async () => {
      await add('Comment');

      await expect(answers(undefined, [upload('comment')])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a value where a file is asked for', async () => {
      await addFile('Passport');

      await expect(
        answers({ passport: 'attached, promise' }, [upload('passport')]),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses more files than one request may carry', async () => {
      await addFile('First document', { maxSizeBytes: MAX_UPLOAD_BYTES });
      await addFile('Second document', { maxSizeBytes: MAX_UPLOAD_BYTES });
      await addFile('Third document', { maxSizeBytes: MAX_UPLOAD_BYTES });

      const chunk = Buffer.concat([PDF, Buffer.alloc(7 * 1024 * 1024)]);
      // Each file is within its field's limit; together they are over what one
      // request may carry — and the reverse proxy in front of a production
      // instance would otherwise be the thing that answers.
      await expect(
        answers(undefined, [
          upload('first-document', { bytes: chunk }),
          upload('second-document', { bytes: chunk }),
          upload('third-document', { bytes: chunk }),
        ]),
      ).rejects.toThrow(PayloadTooLargeException);
      expect(3 * chunk.length).toBeGreaterThan(MAX_SUBMISSION_BYTES);
    });

    it('refuses two files for one field', async () => {
      await addFile('Passport');

      await expect(
        answers(undefined, [upload('passport'), upload('passport')]),
      ).rejects.toThrow(BadRequestException);
    });

    it('makes the file name safe rather than refusing it', async () => {
      await addFile('Passport');

      const checked = await service.validateSubmission(EVENT.id, undefined, [
        upload('passport', { fileName: '../../etc/pa"ssport.pdf' }),
      ]);

      // A name from a form ends up in a header and on somebody's disk; what it
      // must not do is refuse a registration over a character.
      expect(checked.uploads[0].fileName).toBe('passport.pdf');
    });

    it('stores the answers in form order, whatever order they arrived in', async () => {
      await add('First');
      await add('Second');

      const stored = await answers({
        second: 'b',
        first: 'a',
      });

      // The same set of answers is then stored the same way every time, which is
      // what makes the JSONB column comparable at all.
      expect(Object.keys(stored)).toEqual(['first', 'second']);
    });
  });
});
