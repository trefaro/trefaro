import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MAX_PROFILE_FIELDS } from '@trefaro/shared-models';
import type {
  NewProfileField,
  ProfileFieldChanges,
  ProfileFieldRecord,
  ProfileFieldRepository,
} from './ports/profile-field.repository';
import { ProfileFieldKeyTakenError } from './ports/profile-field.repository';
import { ProfileFieldsService } from './profile-fields.service';

/**
 * The profile questions in memory, with the two rules the real table enforces:
 * a key is unique across the instance, and the order is what `sort` says.
 */
class FakeProfileFieldRepository implements ProfileFieldRepository {
  rows: ProfileFieldRecord[] = [];
  private next = 1;

  async findAll(): Promise<readonly ProfileFieldRecord[]> {
    return [...this.rows].sort(
      (a, b) => a.sort - b.sort || a.id.localeCompare(b.id),
    );
  }

  async findById(id: string): Promise<ProfileFieldRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(field: NewProfileField): Promise<ProfileFieldRecord> {
    if (this.rows.some((row) => row.key === field.key)) {
      throw new ProfileFieldKeyTakenError(field.key);
    }
    const row = { id: `field-${this.next++}`, ...field };
    this.rows.push(row);
    return row;
  }

  async update(
    id: string,
    changes: ProfileFieldChanges,
  ): Promise<ProfileFieldRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = { ...this.rows[index], ...changes };
    return this.rows[index];
  }

  async delete(id: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.id !== id);
    return this.rows.length < before;
  }

  async reorder(
    orderedIds: readonly string[],
  ): Promise<readonly ProfileFieldRecord[]> {
    this.rows = this.rows.map((row) => ({
      ...row,
      sort: orderedIds.indexOf(row.id),
    }));
    return this.findAll();
  }
}

describe('ProfileFieldsService', () => {
  let fields: FakeProfileFieldRepository;
  let service: ProfileFieldsService;

  beforeEach(() => {
    fields = new FakeProfileFieldRepository();
    service = new ProfileFieldsService(fields);
  });

  describe('create', () => {
    it('derives the key from the label and appends the question', async () => {
      const first = await service.create({
        label: 'Which local group are you part of?',
        type: 'text',
      });
      const second = await service.create({
        label: 'Newsletter',
        type: 'checkbox',
      });

      expect(first).toMatchObject({ key: 'which-local-group-are-you-part-of' });
      expect(first.sort).toBe(0);
      // At the end, not in the middle of a form people have already filled in.
      expect(second.sort).toBe(1);
    });

    it('numbers a key that is already taken rather than refusing it', async () => {
      await service.create({ label: 'Languages', type: 'text' });

      const second = await service.create({ label: 'Languages', type: 'text' });

      // Two questions that shorten to the same key are a normal thing to want,
      // and refusing the second would be a dead end nobody can see the cause of.
      expect(second.key).toBe('languages-2');
    });

    it('takes an explicit key literally, and refuses one that is not a key', async () => {
      const field = await service.create({
        label: 'Member number',
        type: 'text',
        key: 'crm-member-id',
      });
      expect(field.key).toBe('crm-member-id');

      await expect(
        service.create({ label: 'Anything', type: 'text', key: 'Not A Key' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a key the profile itself owns (F35)', async () => {
      // A custom answer under `email` would collide with the column of the same
      // meaning the moment anything flattens a profile into one record. Note
      // that "E-mail" slugifies to `e-mail` and is therefore *not* reserved —
      // the list guards keys, not wordings, and that is the honest scope of it.
      await expect(
        service.create({ label: 'Email', type: 'text' }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create({ label: 'Searchable', type: 'checkbox' }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses a selection without choices and choices on anything else', async () => {
      await expect(
        service.create({ label: 'Local group', type: 'select' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          label: 'Newsletter',
          type: 'checkbox',
          options: ['yes'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stops at the ceiling', async () => {
      for (let index = 0; index < MAX_PROFILE_FIELDS; index += 1) {
        await service.create({ label: `Question ${index}`, type: 'text' });
      }

      await expect(
        service.create({ label: 'One too many', type: 'text' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('rewords a question without moving the key an answer sits under', async () => {
      const field = await service.create({
        label: 'Local group',
        type: 'text',
      });

      const updated = await service.update(field.id, {
        label: 'Which local group are you part of?',
      });

      expect(updated).toMatchObject({
        key: 'local-group',
        label: 'Which local group are you part of?',
      });
    });

    it('empties a help text rather than storing the empty string', async () => {
      const field = await service.create({
        label: 'Local group',
        type: 'text',
        helpText: 'Only if you are in one.',
      });

      const updated = await service.update(field.id, { helpText: '  ' });

      expect(updated.helpText).toBeNull();
    });

    it('refuses choices for a question that is not a selection', async () => {
      const field = await service.create({ label: 'Notes', type: 'text' });

      await expect(
        service.update(field.id, { options: ['a', 'b'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('answers 404 for a question that is gone', async () => {
      await expect(
        service.update('field-404', { label: 'Anything' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete and reorder', () => {
    it('removes a question and says so once', async () => {
      const field = await service.create({ label: 'Notes', type: 'text' });

      await service.delete(field.id);

      await expect(service.delete(field.id)).rejects.toThrow(NotFoundException);
    });

    it('takes the whole order, and nothing less', async () => {
      const first = await service.create({ label: 'One', type: 'text' });
      const second = await service.create({ label: 'Two', type: 'text' });

      const ordered = await service.reorder([second.id, first.id]);
      expect(ordered.map((field) => field.key)).toEqual(['two', 'one']);

      // A partial list would renumber some questions and leave the rest at
      // positions that no longer mean anything.
      await expect(service.reorder([first.id])).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.reorder([first.id, first.id, second.id]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateAnswers', () => {
    beforeEach(async () => {
      await service.create({ label: 'Local group', type: 'text' });
      await service.create({
        label: 'Region',
        type: 'select',
        options: ['Europe', 'East Africa'],
      });
      await service.create({
        label: 'Code of conduct',
        type: 'checkbox',
        required: true,
      });
    });

    it('stores only what was answered, in form order (F36)', async () => {
      const stored = await service.validateAnswers({
        'code-of-conduct': true,
        'local-group': '  Cologne  ',
        region: 'Europe',
      });

      expect(Object.keys(stored)).toEqual([
        'local-group',
        'region',
        'code-of-conduct',
      ]);
      expect(stored['local-group']).toBe('Cologne');
    });

    it('drops an answer that is only whitespace instead of storing it', async () => {
      const stored = await service.validateAnswers({
        'local-group': '   ',
        'code-of-conduct': true,
      });

      expect(stored['local-group']).toBeUndefined();
    });

    it('refuses an unknown key rather than dropping it', async () => {
      await expect(
        service.validateAnswers({
          'code-of-conduct': true,
          'favourite-colour': 'red',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a choice the definition does not offer', async () => {
      await expect(
        service.validateAnswers({
          region: 'Antarctica',
          'code-of-conduct': true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('insists a required checkbox is ticked, not merely answered (F36)', async () => {
      await expect(
        service.validateAnswers({ 'code-of-conduct': false }),
      ).rejects.toThrow(BadRequestException);
      await expect(service.validateAnswers({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses an answer of the wrong shape', async () => {
      await expect(
        service.validateAnswers({
          'local-group': true,
          'code-of-conduct': true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('what the two audiences see', () => {
    it('gives the organizer ids and positions and the participant neither', async () => {
      await service.create({ label: 'Local group', type: 'text' });

      const [organizer] = await service.listForOrganizer();
      const [participant] = await service.listForParticipant();

      expect(organizer).toMatchObject({ key: 'local-group', sort: 0 });
      expect(organizer.id).toBeDefined();
      // Nothing a form has to render needs the row's id or its position — the
      // order of the list is the order of the form.
      expect(Object.keys(participant).sort()).toEqual([
        'helpText',
        'key',
        'label',
        'options',
        'required',
        'type',
      ]);
    });
  });
});
