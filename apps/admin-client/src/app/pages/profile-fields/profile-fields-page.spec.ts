import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import type {
  ProfileField,
  ProfileFieldChange,
  ProfileFieldInput,
} from '@trefaro/shared-models';
import { ProfileFieldsAdminService } from '../../features/profiles/profile-fields-admin.service';
import { ProfileFieldsPage } from './profile-fields-page';

function field(overrides: Partial<ProfileField> = {}): ProfileField {
  return {
    id: 'field-1',
    key: 'local-group',
    label: 'Local group',
    type: 'text',
    helpText: null,
    options: [],
    required: false,
    sort: 0,
    ...overrides,
  };
}

class FakeFields {
  rows: ProfileField[] = [field()];
  readonly created: ProfileFieldInput[] = [];
  readonly updated: [string, ProfileFieldChange][] = [];
  readonly removed: string[] = [];
  readonly orders: readonly string[][] = [];

  async list(): Promise<readonly ProfileField[]> {
    return this.rows;
  }

  async create(input: ProfileFieldInput): Promise<ProfileField> {
    this.created.push(input);
    return field({ id: 'field-new', key: 'new', label: input.label });
  }

  async update(id: string, change: ProfileFieldChange): Promise<ProfileField> {
    this.updated.push([id, change]);
    return field({ id });
  }

  async remove(id: string): Promise<void> {
    this.removed.push(id);
  }

  async reorder(ids: readonly string[]): Promise<readonly ProfileField[]> {
    (this.orders as string[][]).push([...ids]);
    return this.rows;
  }
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  form: {
    setValue: (value: {
      label: string;
      type: string;
      optionsText: string;
      helpText: string;
      required: boolean;
    }) => void;
  };
  fields: () => readonly ProfileField[];
  draft: (id: string) => { label: string; optionsText: string };
  edit: (id: string, patch: Record<string, unknown>) => void;
  changed: (field: ProfileField) => boolean;
  add: () => Promise<void>;
  save: (field: ProfileField) => Promise<void>;
  remove: (field: ProfileField) => Promise<void>;
  move: (index: number, offset: number) => Promise<void>;
}

/**
 * The organizer's editor for the profile questions (FR 4.3, E35).
 *
 * What is worth asserting is what the server refuses and what a wrong request
 * would cost: choices only where they mean something, the whole order rather
 * than one move, and a confirmation before a question stops being asked.
 */
describe('ProfileFieldsPage', () => {
  let fields: FakeFields;

  async function render(rows: ProfileField[] = [field()]) {
    fields = new FakeFields();
    fields.rows = rows;

    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({
          'admin.profileFields.title': 'Profile form',
        }),
        { provide: ProfileFieldsAdminService, useValue: fields },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            translate: (key: string) => key,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProfileFieldsPage);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance as unknown as PageInternals,
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('reads the questions on arrival', async () => {
    const { page } = await render();

    expect(page.fields().map((row) => row.key)).toEqual(['local-group']);
  });

  it('sends the choices of a selection field, one per line', async () => {
    const { page } = await render();
    page.form.setValue({
      label: 'Committee',
      type: 'select',
      optionsText: 'Board\n  Working group  \n\nNone\n',
      helpText: '  ',
      required: true,
    });

    await page.add();

    expect(fields.created).toEqual([
      {
        label: 'Committee',
        type: 'select',
        // Trimmed, blank lines dropped — the rule both field editors share.
        options: ['Board', 'Working group', 'None'],
        // Whitespace is not an explanation.
        helpText: null,
        required: true,
      },
    ]);
  });

  it('sends no choices for a question that is not a selection', async () => {
    const { page } = await render();
    page.form.setValue({
      label: 'Local group',
      type: 'text',
      optionsText: 'left over from switching the kind',
      helpText: '',
      required: false,
    });

    await page.add();

    // The server refuses choices on anything but a selection field, and it is
    // right to: they would be data nothing reads.
    expect(fields.created[0].options).toEqual([]);
  });

  it('only offers Save once a row differs from the server', async () => {
    const { page } = await render();
    const row = field();

    expect(page.changed(row)).toBe(false);
    page.edit(row.id, { label: 'Which local group?' });
    expect(page.changed(row)).toBe(true);
  });

  it('keeps the choices out of an update to a text question', async () => {
    const { page } = await render();
    page.edit('field-1', { label: 'Which local group?' });

    await page.save(field());

    expect(fields.updated).toEqual([
      [
        'field-1',
        { label: 'Which local group?', helpText: null, required: false },
      ],
    ]);
  });

  it('asks before a question stops being asked, and says the answers stay', async () => {
    const { page } = await render();
    const confirmed = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await page.remove(field());

    expect(confirmed).toHaveBeenCalledWith('admin.profileFields.confirmRemove');
    expect(fields.removed).toEqual([]);
  });

  it('removes the question once that is confirmed', async () => {
    const { page } = await render();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await page.remove(field());

    expect(fields.removed).toEqual(['field-1']);
  });

  it('sends the whole new order rather than one move', async () => {
    const { page } = await render([
      field({ id: 'a', key: 'a', sort: 0 }),
      field({ id: 'b', key: 'b', sort: 1 }),
      field({ id: 'c', key: 'c', sort: 2 }),
    ]);

    await page.move(2, -1);

    // Two organizers each moving one field would otherwise interleave into an
    // order neither asked for.
    expect(fields.orders).toEqual([['a', 'c', 'b']]);
  });

  it('does nothing when a move would leave the list', async () => {
    const { page } = await render([field({ id: 'a' })]);

    await page.move(0, -1);

    expect(fields.orders).toEqual([]);
  });
});
