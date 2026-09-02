import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
import type {
  MyRegistrationPage,
  MyRegistrationSummary,
  PublicEvent,
  RegistrationStatus,
} from '@trefaro/shared-models';
import { SelfServiceService } from '../../features/self-service/self-service.service';
import { MyRegistrationsPage } from './my-registrations-page';

const EVENT: PublicEvent = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Cologne',
  description: 'The event this registration is for.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  followUpBody: null,
};

const summary = (
  id: string,
  status: RegistrationStatus = 'confirmed',
): MyRegistrationSummary => ({
  id,
  status,
  registeredAt: '2026-09-01T10:00:00.000Z',
  confirmedAt: status === 'pending' ? null : '2026-09-01T10:05:00.000Z',
  seriesSlug: 'buergerraete',
  event: EVENT,
});

/** The list endpoint, one page at a time (FR 4.7). */
class FakeSelfService {
  pages: MyRegistrationPage[] = [
    { rows: [summary('registration-1')], total: 1, page: 1, pageSize: 10 },
  ];
  readonly asked: { locale: string; page: number }[] = [];
  failing = false;

  async listMine(locale: string, page = 1): Promise<MyRegistrationPage> {
    this.asked.push({ locale, page });
    if (this.failing) throw { status: 500, explained: false };
    const found = this.pages[page - 1];
    if (!found) throw new Error(`No page ${page} in this fake`);
    return found;
  }
}

interface PageInternals {
  rows: () => readonly MyRegistrationSummary[];
  more: () => boolean;
  loaded: () => boolean;
  loadMore: () => Promise<void>;
  statusKey: (entry: MyRegistrationSummary) => string;
}

/**
 * "My registrations" (FR 4.7).
 *
 * The markup is the browser suite's subject. What is worth a test here is the
 * paging and the two states a list can be in without being empty: not asked
 * yet, and asked and failed.
 */
describe('MyRegistrationsPage', () => {
  let selfService: FakeSelfService;

  async function render(setUp: (fake: FakeSelfService) => void = () => void 0) {
    selfService = new FakeSelfService();
    setUp(selfService);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({ 'mine.list.title': 'My registrations' }),
        { provide: SelfServiceService, useValue: selfService },
        {
          provide: TranslationService,
          useValue: { locale: signal('en'), translate: (key: string) => key },
        },
      ],
    });

    const fixture = TestBed.createComponent(MyRegistrationsPage);
    fixture.detectChanges();
    // The list is read in an effect; a turn of the microtask queue is what the
    // fake needs to answer.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance as unknown as PageInternals,
    };
  }

  it('asks for the first page in the reader’s language', async () => {
    const { page } = await render();

    expect(selfService.asked).toEqual([{ locale: 'en', page: 1 }]);
    expect(page.rows().map((row) => row.id)).toEqual(['registration-1']);
    expect(page.loaded()).toBe(true);
  });

  it('appends the next page instead of replacing it', async () => {
    const { page } = await render((fake) => {
      fake.pages = [
        { rows: [summary('one')], total: 2, page: 1, pageSize: 1 },
        { rows: [summary('two')], total: 2, page: 2, pageSize: 1 },
      ];
    });

    expect(page.more()).toBe(true);
    await page.loadMore();

    expect(page.rows().map((row) => row.id)).toEqual(['one', 'two']);
    // Nothing left to fetch, so the button goes away rather than asking for a
    // page that does not exist.
    expect(page.more()).toBe(false);
  });

  it('does not offer more when the page holds everything', async () => {
    const { page } = await render();

    expect(page.more()).toBe(false);
  });

  it('tells "not loaded" apart from "nothing to show"', async () => {
    const { page } = await render((fake) => {
      fake.failing = true;
    });

    // An empty list and a failed request look the same in an array, and only
    // one of them deserves the sentence about having no registrations (F146).
    expect(page.rows()).toEqual([]);
    expect(page.loaded()).toBe(false);
  });

  it('names a state by its shared key, not by a word of its own', async () => {
    const { page } = await render((fake) => {
      fake.pages = [
        { rows: [summary('one', 'pending')], total: 1, page: 1, pageSize: 10 },
      ];
    });

    // The same key the organizer client shows for the same state (F83).
    expect(page.statusKey(page.rows()[0])).toBe('registration.status.pending');
  });
});
