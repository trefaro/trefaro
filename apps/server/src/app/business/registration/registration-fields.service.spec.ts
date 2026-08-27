import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { OrganizerEvent, PublicEvent } from '@trefaro/shared-models';
import { MAX_CUSTOM_TEXT_LENGTH } from '@trefaro/shared-models';
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
        required: false,
      });
    });
  });

  describe('validateAnswers', () => {
    it('accepts a registration for an event without extra fields', async () => {
      await expect(
        service.validateAnswers(EVENT.id, undefined),
      ).resolves.toEqual({});
    });

    it('refuses an unknown key instead of dropping it', async () => {
      await add('Dietary requirements');

      // The rule the global validation pipe applies to the request's own
      // properties, one level down: a typo must not cost an answer silently.
      await expect(
        service.validateAnswers(EVENT.id, { 'dietary-requirement': 'vegan' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a missing answer to a required field', async () => {
      await add('Passport name', { required: true });

      await expect(service.validateAnswers(EVENT.id, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('treats an empty string as no answer at all', async () => {
      await add('Passport name', { required: true });

      await expect(
        service.validateAnswers(EVENT.id, { 'passport-name': '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('drops an unanswered optional field rather than storing an empty value', async () => {
      await add('Comment');

      await expect(
        service.validateAnswers(EVENT.id, { comment: '' }),
      ).resolves.toEqual({});
    });

    it('trims what was typed', async () => {
      await add('Passport name');

      await expect(
        service.validateAnswers(EVENT.id, { 'passport-name': '  Amina  ' }),
      ).resolves.toEqual({ 'passport-name': 'Amina' });
    });

    it('refuses an answer longer than a text field takes', async () => {
      await add('Comment');

      await expect(
        service.validateAnswers(EVENT.id, {
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

      await expect(
        service.validateAnswers(EVENT.id, { meal: 'Steak' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a required checkbox to be ticked, not merely answered', async () => {
      await add('Code of conduct', { type: 'checkbox', required: true });

      // A consent box that accepts "no" is not a consent box.
      await expect(
        service.validateAnswers(EVENT.id, { 'code-of-conduct': false }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateAnswers(EVENT.id, { 'code-of-conduct': true }),
      ).resolves.toEqual({ 'code-of-conduct': true });
    });

    it('keeps a "no" to an optional checkbox', async () => {
      await add('Needs a visa letter', { type: 'checkbox' });

      // "No" is an answer; only an absent key means the question was skipped.
      await expect(
        service.validateAnswers(EVENT.id, { 'needs-a-visa-letter': false }),
      ).resolves.toEqual({ 'needs-a-visa-letter': false });
    });

    it('refuses a value of the wrong kind', async () => {
      await add('Comment');
      await add('Visa', { type: 'checkbox' });

      await expect(
        service.validateAnswers(EVENT.id, {
          comment: true,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validateAnswers(EVENT.id, { visa: 'yes' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores the answers in form order, whatever order they arrived in', async () => {
      await add('First');
      await add('Second');

      const stored = await service.validateAnswers(EVENT.id, {
        second: 'b',
        first: 'a',
      });

      // The same set of answers is then stored the same way every time, which is
      // what makes the JSONB column comparable at all.
      expect(Object.keys(stored)).toEqual(['first', 'second']);
    });
  });
});
