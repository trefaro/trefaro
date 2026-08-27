import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { EventSeries, EventSeriesInput } from '@trefaro/shared-models';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { SeriesFormPage } from './series-form-page';

const existing: EventSeries = {
  id: 'series-1',
  slug: 'climate-conference-2027',
  name: 'Climate Conference 2027',
  description: 'Three days on citizen participation.',
  logoUrl: null,
  websiteUrl: 'https://example.org',
  contactEmail: null,
  status: 'published',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

interface Recorded {
  created: EventSeriesInput[];
  updated: { id: string; input: Partial<EventSeriesInput> }[];
}

/** The template drives protected members; the tests reach them the same way. */
interface FormPageInternals {
  form: { setValue: (value: Record<string, string>) => void };
  submit: () => Promise<void>;
}

function render(options: { id?: string } = {}) {
  const recorded: Recorded = { created: [], updated: [] };

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: EventSeriesAdminService,
        useValue: {
          get: () => Promise.resolve(existing),
          create: (input: EventSeriesInput) => {
            recorded.created.push(input);
            return Promise.resolve(existing);
          },
          update: (id: string, input: Partial<EventSeriesInput>) => {
            recorded.updated.push({ id, input });
            return Promise.resolve(existing);
          },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(SeriesFormPage);
  if (options.id !== undefined) {
    fixture.componentRef.setInput('id', options.id);
  }
  fixture.detectChanges();

  return {
    page: fixture.componentInstance as unknown as FormPageInternals,
    recorded,
    fixture,
  };
}

describe('SeriesFormPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('leaves the address out of the payload when the field is empty', async () => {
    const { page, recorded } = render();
    page.form.setValue({
      name: 'New Series',
      description: 'A description.',
      slug: '',
      websiteUrl: '',
      contactEmail: '',
      status: 'draft',
    });

    await page.submit();

    // The server derives a better address from the name than an empty string,
    // and on an update an empty field must not wipe an existing one.
    expect(recorded.created).toEqual([
      {
        name: 'New Series',
        description: 'A description.',
        websiteUrl: null,
        contactEmail: null,
        status: 'draft',
      },
    ]);
  });

  it('sends the address when the organizer typed one', async () => {
    const { page, recorded } = render();
    page.form.setValue({
      name: 'New Series',
      description: 'A description.',
      slug: '  cop-2027 ',
      websiteUrl: 'https://example.org',
      contactEmail: 'hello@example.org',
      status: 'published',
    });

    await page.submit();

    expect(recorded.created[0]).toMatchObject({
      slug: 'cop-2027',
      websiteUrl: 'https://example.org',
      contactEmail: 'hello@example.org',
      status: 'published',
    });
  });

  it('refuses to submit without a name rather than sending an empty one', async () => {
    const { page, recorded } = render();
    page.form.setValue({
      name: '',
      description: 'A description.',
      slug: '',
      websiteUrl: '',
      contactEmail: '',
      status: 'draft',
    });

    await page.submit();

    expect(recorded.created).toHaveLength(0);
  });

  it('loads the series it is editing and updates instead of creating', async () => {
    const { page, recorded, fixture } = render({ id: 'series-1' });
    await fixture.whenStable();
    fixture.detectChanges();

    await page.submit();

    expect(recorded.created).toHaveLength(0);
    expect(recorded.updated[0].id).toBe('series-1');
    expect(recorded.updated[0].input).toMatchObject({
      name: existing.name,
      slug: existing.slug,
      status: 'published',
    });
  });
});
