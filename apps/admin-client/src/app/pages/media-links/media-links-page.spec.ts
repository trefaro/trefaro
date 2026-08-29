import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type {
  MediaLink,
  MediaLinkChange,
  MediaLinkInput,
  OrganizerEvent,
  ProgramItem,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { MediaLinksAdminService } from '../../features/media-links/media-links-admin.service';
import { ProgramAdminService } from '../../features/program/program-admin.service';
import { MediaLinksPage } from './media-links-page';

const EVENT = {
  id: 'event-1',
  seriesId: 'series-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  timezone: 'Europe/Berlin',
} as OrganizerEvent;

const SESSION = {
  id: 'session-1',
  eventId: 'event-1',
  title: 'Opening keynote',
} as ProgramItem;

function link(overrides: Partial<MediaLink> = {}): MediaLink {
  return {
    id: 'link-1',
    eventId: 'event-1',
    kind: 'stream',
    title: 'Watch live',
    url: 'https://tube.example.org/live',
    programItemId: null,
    createdAt: '2026-08-27T09:00:00.000Z',
    updatedAt: '2026-08-27T09:00:00.000Z',
    ...overrides,
  };
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  error: () => string | null;
  edit: (id: string, patch: Partial<Record<string, unknown>>) => void;
  changed: (link: MediaLink) => boolean;
  save: (link: MediaLink) => Promise<void>;
  remove: (link: MediaLink) => Promise<void>;
  add: () => Promise<void>;
  form: {
    setValue: (value: {
      kind: string;
      title: string;
      url: string;
      programItemId: string;
    }) => void;
  };
}

class FakeMediaLinksAdminService {
  rows: MediaLink[] = [link()];
  readonly created: MediaLinkInput[] = [];
  readonly updated: { id: string; change: MediaLinkChange }[] = [];
  readonly removed: string[] = [];
  reads = 0;

  list(): Promise<readonly MediaLink[]> {
    this.reads += 1;
    return Promise.resolve(this.rows);
  }

  create(_eventId: string, input: MediaLinkInput): Promise<MediaLink> {
    this.created.push(input);
    return Promise.resolve(link(input as Partial<MediaLink>));
  }

  update(id: string, change: MediaLinkChange): Promise<MediaLink> {
    this.updated.push({ id, change });
    return Promise.resolve(link({ id, ...(change as Partial<MediaLink>) }));
  }

  remove(id: string): Promise<void> {
    this.removed.push(id);
    return Promise.resolve();
  }
}

async function render(
  seeded: { rows?: MediaLink[]; moduleEnabled?: boolean } = {},
): Promise<{
  page: PageInternals;
  mediaLinks: FakeMediaLinksAdminService;
  text: () => string;
  html: () => string;
  options: () => string[];
  /** The row inputs' values — a title lives in a field, not in the page text. */
  fields: () => string[];
  settle: () => Promise<void>;
}> {
  const mediaLinks = new FakeMediaLinksAdminService();
  if (seeded.rows) mediaLinks.rows = seeded.rows;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      // The kinds are named from the catalogue since AP 8 of phase 2; the rest
      // of this client's text follows in AP 9.
      provideTranslationsForTest({
        'mediaLinks.kind.stream.one': 'Live stream',
        'mediaLinks.kind.recording.one': 'Recording',
        'mediaLinks.kind.material.one': 'Material',
      }),
      {
        provide: EventsAdminService,
        useValue: { get: () => Promise.resolve(EVENT) },
      },
      { provide: MediaLinksAdminService, useValue: mediaLinks },
      {
        provide: ProgramAdminService,
        useValue: { list: () => Promise.resolve([SESSION]) },
      },
      {
        provide: AppConfigService,
        useValue: {
          isModuleEnabled: () => seeded.moduleEnabled ?? true,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(MediaLinksPage);
  fixture.componentRef.setInput('seriesId', 'series-1');
  fixture.componentRef.setInput('eventId', 'event-1');
  fixture.detectChanges();
  // Three passes, and not one: the page reads the event first and only then its
  // links and sessions, so the load is two awaits deep — and the render after
  // the last one has to happen too. Returning while any of it is still in flight
  // leaves a test acting on a page whose load then overwrites what it did.
  for (let pass = 0; pass < 3; pass += 1) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const host = fixture.nativeElement as HTMLElement;
  return {
    page: fixture.componentInstance as unknown as PageInternals,
    mediaLinks,
    text: () => host.textContent ?? '',
    html: () => host.innerHTML,
    options: () =>
      [...host.querySelectorAll('option')].map((option) =>
        (option.textContent ?? '').trim(),
      ),
    fields: () =>
      [...host.querySelectorAll('input')].map((input) => input.value),
    settle: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
}

describe('MediaLinksPage', () => {
  it('lists the links of the event with their kind', async () => {
    const { text, fields } = await render({
      rows: [
        link(),
        link({
          id: 'link-2',
          kind: 'material',
          title: 'Slides',
          url: 'https://files.example.org/slides.pdf',
        }),
      ],
    });

    // The titles are editable fields, so they are values rather than page text.
    expect(fields()).toContain('Watch live');
    expect(fields()).toContain('Slides');
    // The kind is named once per row, and the address is shown so it can be
    // checked — the instance never fetches it to find out what it is (F51).
    expect(text()).toContain('Live stream');
    expect(text()).toContain('https://files.example.org/slides.pdf');
  });

  it('opens every address in a new tab without a referrer (F51)', async () => {
    const { html } = await render();

    // Not embedded, and following the link does not tell the other side which
    // instance sent the visitor (NFR 9).
    expect(html()).toContain('rel="noopener noreferrer"');
    expect(html()).toContain('target="_blank"');
  });

  it('offers the sessions of this event to attach a link to', async () => {
    const { options } = await render();

    expect(options()).toContain('The whole event');
    expect(options()).toContain('Opening keynote');
  });

  it('says the module is off instead of showing an editor that cannot work', async () => {
    const { text, mediaLinks } = await render({ moduleEnabled: false });

    // Every endpoint answers 404 while `media-links` is switched off (F53), so
    // asking would produce an error message about a configuration decision.
    expect(text()).toContain('switched off');
    expect(mediaLinks.reads).toBe(0);
  });

  it('refuses an address a click could not follow before sending it', async () => {
    const { page, mediaLinks } = await render();

    page.form.setValue({
      kind: 'recording',
      title: 'Keynote',
      url: 'tube.example.org/keynote',
      programItemId: '',
    });
    await page.add();

    expect(page.error()).toContain('http');
    expect(mediaLinks.created).toEqual([]);
  });

  it('adds a link that belongs to the whole event', async () => {
    const { page, mediaLinks, settle } = await render();

    page.form.setValue({
      kind: 'recording',
      title: 'Keynote recording',
      url: 'https://tube.example.org/w/keynote',
      programItemId: '',
    });
    await page.add();
    await settle();

    // An empty select value means the event as a whole; the API takes `null`.
    expect(mediaLinks.created).toEqual([
      {
        kind: 'recording',
        title: 'Keynote recording',
        url: 'https://tube.example.org/w/keynote',
        programItemId: null,
      },
    ]);
    // Read back rather than patched in place: the server owns the order (F52).
    expect(mediaLinks.reads).toBe(2);
  });

  it('adds a link that belongs to one session', async () => {
    const { page, mediaLinks } = await render();

    page.form.setValue({
      kind: 'recording',
      title: 'Keynote recording',
      url: 'https://tube.example.org/w/keynote',
      programItemId: 'session-1',
    });
    await page.add();

    expect(mediaLinks.created[0].programItemId).toBe('session-1');
  });

  it('saves a row only once something about it changed', async () => {
    const { page } = await render();
    const row = link();

    expect(page.changed(row)).toBe(false);
    page.edit(row.id, { title: 'Watch it live' });
    expect(page.changed(row)).toBe(true);
  });

  it('sends what the row holds when it is saved', async () => {
    const { page, mediaLinks } = await render();
    const row = link();

    page.edit(row.id, { kind: 'recording', programItemId: 'session-1' });
    await page.save(row);

    expect(mediaLinks.updated).toEqual([
      {
        id: 'link-1',
        change: {
          kind: 'recording',
          title: 'Watch live',
          url: 'https://tube.example.org/live',
          programItemId: 'session-1',
        },
      },
    ]);
  });

  it('removes a link once the question is answered', async () => {
    const { page, mediaLinks } = await render();
    const confirmed = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await page.remove(link());

    expect(confirmed).toHaveBeenCalled();
    expect(mediaLinks.removed).toEqual(['link-1']);
    confirmed.mockRestore();
  });

  it('keeps a link when the question is answered with no', async () => {
    const { page, mediaLinks } = await render();
    const asked = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await page.remove(link());

    expect(mediaLinks.removed).toEqual([]);
    asked.mockRestore();
  });
});
