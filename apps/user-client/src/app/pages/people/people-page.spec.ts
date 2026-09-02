import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
import type {
  ParticipantAccount,
  ProfileSearchPage,
  ProfileSearchQuery,
} from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';
import { ProfileSearchService } from '../../features/profiles/profile-search.service';
import { PeoplePage } from './people-page';

function hit(id: string, firstName: string, lastName: string) {
  return {
    id,
    firstName,
    lastName,
    avatarUrl: null,
    activityAreas: 'Election observation',
  };
}

class FakeSearch {
  readonly asked: ProfileSearchQuery[] = [];
  answer: ProfileSearchPage = {
    rows: [hit('a1', 'Amina', 'Okonkwo')],
    total: 3,
    page: 1,
    pageSize: 1,
  };
  fails: unknown = null;

  async find(query: ProfileSearchQuery): Promise<ProfileSearchPage> {
    this.asked.push(query);
    if (this.fails) throw this.fails;
    return {
      ...this.answer,
      rows: [hit(`p${this.asked.length}`, 'Bo', `Row${this.asked.length}`)],
      page: query.page ?? 1,
    };
  }
}

const account = (searchable: boolean): ParticipantAccount => ({
  id: 'me',
  email: 'me@example.org',
  firstName: 'Rea',
  lastName: 'Reader',
  preferredLocale: 'en',
  avatarUrl: null,
  activityAreas: null,
  customFields: {},
  searchable,
  confirmedAt: '2026-09-01T10:00:00.000Z',
});

/**
 * The participant search (FR 4.4).
 *
 * The list itself is the browser suite's subject. What belongs here are the
 * three decisions this page makes on its own: it asks before anybody types, a
 * new question starts a new result, and somebody who cannot be found is told
 * so where the switch makes sense (F142).
 */
describe('PeoplePage', () => {
  let people: FakeSearch;

  async function render(searchable = true) {
    people = new FakeSearch();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({
          'people.title': 'Find participants',
          'people.optIn': 'Other participants cannot find you yet.',
          'people.empty': 'No profile matches this search.',
          'people.more': 'Show more',
        }),
        { provide: ProfileSearchService, useValue: people },
        {
          provide: ParticipantSessionService,
          useValue: { participant: signal(account(searchable)) },
        },
        {
          provide: TranslationService,
          useValue: { locale: signal('en'), translate: (key: string) => key },
        },
      ],
    });

    const fixture = TestBed.createComponent(PeoplePage);
    fixture.detectChanges();
    // The first page is read in the constructor; a turn of the microtask queue
    // is what the fake needs to answer.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const page = fixture.componentInstance as unknown as {
      form: { patchValue: (value: Record<string, unknown>) => void };
      submit: () => Promise<void>;
      loadMore: () => Promise<void>;
      rows: () => readonly { id: string }[];
    };

    return {
      fixture,
      page,
      text: () => String(fixture.nativeElement.textContent),
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('asks before anybody types — an empty search is the directory', async () => {
    const { page } = await render();

    expect(people.asked).toEqual([{ search: '', activityAreas: '', page: 1 }]);
    expect(page.rows()).toHaveLength(1);
  });

  it('sends both boxes, trimmed', async () => {
    const { page } = await render();

    page.form.patchValue({
      search: '  Amina Okonkwo ',
      activityAreas: ' observation ',
    });
    await page.submit();

    expect(people.asked[1]).toEqual({
      search: 'Amina Okonkwo',
      activityAreas: 'observation',
      page: 1,
    });
  });

  it('starts a new question at page one rather than appending to the old one', async () => {
    const { page } = await render();

    await page.loadMore();
    expect(people.asked[1].page).toBe(2);
    expect(page.rows()).toHaveLength(2);

    page.form.patchValue({ search: 'somebody else' });
    await page.submit();

    // Two answers mixed into one list would be a result nobody asked for.
    expect(people.asked[2].page).toBe(1);
    expect(page.rows()).toHaveLength(1);
  });

  it('keeps the rows on screen when a further page fails', async () => {
    const { page } = await render();

    people.fails = { status: 500, explained: false };
    await page.loadMore();

    // A failed second page is no reason to take the first one away.
    expect(page.rows()).toHaveLength(1);
  });

  it('tells somebody who cannot be found where to change that', async () => {
    const { text } = await render(false);

    expect(text()).toContain('Other participants cannot find you yet.');
  });

  it('says nothing of the sort to somebody who opted in', async () => {
    const { text } = await render(true);

    expect(text()).not.toContain('Other participants cannot find you yet.');
  });
});
